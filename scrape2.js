const _ = require('lodash');
const json2xls = require('json2xls');
const fs = require('fs');
const cheerio = require('cheerio');
const got = require('got');

const startUrl = `https://www.europeanmint.com/`;
const topLinks = [];
let subLinks = [];
const coins = [];

(async () => {
  const getTopLinks = async () => {
    console.log('start 1');
    await got(startUrl)
      .then((res) => {
        const $ = cheerio.load(res.body);
        $('div.nav-container .level0 a.level-top').each((i, link) => {
          const href = link.attribs.href;
          topLinks.push(href);
        });
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const getSubLinks = async () => {
    console.log('start 2');
    let partial = [];
    for (let index = 0; index < 2; index++) {
      await got(topLinks[index])
        .then((res) => {
          const $ = cheerio.load(res.body);
          $('div.category-products .item a').each((i, link) => {
            const href = link.attribs.href;
            partial.push(href);
          });
        })
        .catch((err) => {
          console.log(err);
        });
    }
    subLinks = _.uniq(partial);
    // subLinks = _.uniq(partial).slice(102, 114);
  };

  const getCoins = async () => {
    console.log('start 3');
    for (link of subLinks) {
      await getCoin(link);
    }
  };

  const getCoin = async (link) => {
    await got(link)
      .then((res) => {
        const $ = cheerio.load(res.body);
        let coin = {};
        coin['url'] = link;
        coin['name'] = $('.product-name > h1').html();
        coin['price'] = parseFloat(
          $('.price-box .price').html().replace('&#x20AC;', '').replace(',', '')
        );
        let desc = $('div.std').html();
        desc = desc
          .split('<br>')
          .map((item) => {
            let partial = item
              .trim()
              .replace(/<\/?[^>]+(>|$)/g, '')
              .split(':');
            let int;
            if (partial[0] === 'Metal Content' || partial[0] === 'Weight') {
              partial[0] = partial[0].replace('Metal ', '');
              if (partial[1].includes('troy oz')) {
                int = parseFloat(partial[1].trim().replace('troy oz', ''), 10);
              }
              if (partial[1].includes('grams')) {
                int =
                  parseFloat(partial[1].trim().replace('grams', ''), 10) /
                  31.103;
              }
            }
            const obj = {};
            obj[partial[0]] = int ? int : partial[1];
            if (partial[1]) {
              return obj;
            }
          })
          .reduce((r, c) => Object.assign(r, c), {});
        coin = { ...coin, ...desc };
        coin['per oz'] = coin['Weight']
          ? coin['price'] / coin['Weight']
          : coin['price'] / coin['Content'];

        coin['Weight'] = coin['Weight'] ? coin['Weight'] : '';
        coins.push(coin);
        console.log(coin);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  await getTopLinks();
  await getSubLinks();
  await getCoins();

  console.log('fnished');
  fs.writeFileSync('data.xlsx', (xls = json2xls(coins)), 'binary');
})();
