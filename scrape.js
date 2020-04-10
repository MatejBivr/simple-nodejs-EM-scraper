const puppeteer = require('puppeteer');
const _ = require('lodash');
const json2xls = require('json2xls');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  let subLinks = [];
  const coins = [];

  await page.goto(`https://www.europeanmint.com/`);

  const visitLink = async (index = 0) => {
    const popup = await page.waitFor('#esns_box_close');

    popup.click();

    const links = await page.$$('div.nav-container .level0 a.level-top');

    if (links[index]) {
      await Promise.all([
        await page.evaluate((element) => {
          element.click();
        }, links[index]),

        await page.waitForNavigation(),

        await page.waitFor('body.catalog-category-view'),
      ]);

      const partial = await page.evaluate((selector) => {
        const links = [...document.querySelectorAll(selector)].map(
          (link) => link.href
        );
        return links;
      }, 'div.category-products .item a');

      subLinks = _.uniq(subLinks.concat(partial));

      await page.goBack({ waitUntil: 'networkidle0' });
      if (index < 1) {
        return visitLink(index + 1);
      }
    }
    console.log('No links left to click');
  };

  const visitSubLink = async (index = 0) => {
    console.log(index);
    if (subLinks[index]) {
      await Promise.all([
        await page.goto(subLinks[index], { waitUntil: 'networkidle0' }),
        await page.waitFor('body.catalog-product-view'),
      ]);
    }
    const coin = {};
    coin['url'] = subLinks[index];
    coin['name'] = await page.$eval(
      '.product-name > h1',
      (div) => div.innerHTML
    );
    coin['price'] = await page.$eval(
      '.price-box .price',
      (div) => div.innerHTML
    );
    let desc = await page.$eval('div.std', (div) => div.outerHTML);
    desc = desc
      .split('<br>')
      .map((item) => {
        let partial = item.replace(/<\/?[^>]+(>|$)/g, '').split(':');
        const obj = {};
        obj[partial[0]] = partial[1];
        return obj;
      })
      .reduce((r, c) => Object.assign(r, c), {});

    coins.push({ ...coin, ...desc });
    await page.goBack({ waitUntil: 'networkidle0' });
    if (index < subLinks.length - 1) {
      return visitSubLink(index + 1);
    }
  };

  await visitLink();

  await visitSubLink();

  await browser.close();
  const xls = json2xls(coins);
  fs.writeFileSync('data.xlsx', xls, 'binary');
})();
