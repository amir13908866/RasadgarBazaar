const axios = require("axios");


/* =========================
   ارزهای پشتیبانی‌شده
========================= */

const COINS = {

    BTCUSDT: {
        name: "Bitcoin",
        id: "bitcoin"
    },

    ETHUSDT: {
        name: "Ethereum",
        id: "ethereum"
    },

    SOLUSDT: {
        name: "Solana",
        id: "solana"
    },

    XRPUSDT: {
        name: "XRP",
        id: "ripple"
    },

    BNBUSDT: {
        name: "BNB",
        id: "binancecoin"
    },

    ADAUSDT: {
        name: "Cardano",
        id: "cardano"
    },

    DOGEUSDT: {
        name: "Dogecoin",
        id: "dogecoin"
    },

    AVAXUSDT: {
        name: "Avalanche",
        id: "avalanche-2"
    },

    DOTUSDT: {
        name: "Polkadot",
        id: "polkadot"
    },

    LINKUSDT: {
        name: "Chainlink",
        id: "chainlink"
    },

    LTCUSDT: {
        name: "Litecoin",
        id: "litecoin"
    },

    TRXUSDT: {
        name: "TRON",
        id: "tron"
    },

    SHIBUSDT: {
        name: "Shiba Inu",
        id: "shiba-inu"
    }

};


/* =========================
   پیدا کردن ارز
========================= */

function getCoin(symbol) {

    const clean =
        String(symbol || "")
            .toUpperCase()
            .replace("/", "")
            .replace("-", "")
            .trim();


    if (!COINS[clean]) {

        throw new Error(
            "این ارز در فهرست رصدگر وجود ندارد."
        );
    }


    return {
        symbol: clean,
        name: COINS[clean].name,
        coinId: COINS[clean].id
    };
}


/* =========================
   تبدیل قیمت‌ها به کندل
========================= */

function pricesToCandles(prices) {

    if (
        !Array.isArray(prices) ||
        prices.length < 2
    ) {

        return [];
    }


    const candles = [];


    for (
        let i = 0;
        i < prices.length;
        i++
    ) {

        const current =
            Number(prices[i][1]);


        if (
            !Number.isFinite(current)
        ) {

            continue;
        }


        const previous =
            i > 0
                ? Number(prices[i - 1][1])
                : current;


        candles.push({

            time:
                Number(prices[i][0]),

            open:
                previous,

            high:
                Math.max(
                    previous,
                    current
                ),

            low:
                Math.min(
                    previous,
                    current
                ),

            close:
                current,

            volume:
                0
        });
    }


    return candles;
}


/* =========================
   CoinGecko
========================= */

async function getCoinGecko(
    coinId
) {

    const response =
        await axios.get(

            "https://api.coingecko.com/api/v3/coins/" +
            coinId +
            "/market_chart",

            {

                params: {

                    vs_currency: "usd",

                    days: 30

                },

                timeout: 20000
            }
        );


    const data =
        response.data;


    if (
        !data ||
        !Array.isArray(data.prices)
    ) {

        throw new Error(
            "CoinGecko داده قیمت ارائه نکرد."
        );
    }


    const candles =
        pricesToCandles(
            data.prices
        );


    if (
        candles.length < 50
    ) {

        throw new Error(
            "CoinGecko کندل کافی ارائه نکرد."
        );
    }


    /*
       حجم را تا حد امکان از
       total_volumes می‌گیریم.
    */

    if (
        Array.isArray(
            data.total_volumes
        )
    ) {

        for (
            let i = 0;
            i < candles.length &&
            i < data.total_volumes.length;
            i++
        ) {

            candles[i].volume =
                Number(
                    data.total_volumes[i][1]
                ) || 0;
        }
    }


    const last =
        candles[
            candles.length - 1
        ];


    return {

        price:
            last.close,

        candles:
            candles
    };
}


/* =========================
   CoinCap
========================= */

async function getCoinCap(
    symbol
) {

    const assets = {

        BTCUSDT: "bitcoin",
        ETHUSDT: "ethereum",
        BNBUSDT: "binance-coin",
        SOLUSDT: "solana",
        XRPUSDT: "xrp",
        ADAUSDT: "cardano",
        DOGEUSDT: "dogecoin",
        TRXUSDT: "tron",
        AVAXUSDT: "avalanche",
        DOTUSDT: "polkadot",
        LTCUSDT: "litecoin",
        LINKUSDT: "chainlink",
        SHIBUSDT: "shiba-inu"

    };


    const asset =
        assets[symbol];


    if (!asset) {

        throw new Error(
            "CoinCap این ارز را ندارد."
        );
    }


    const response =
        await axios.get(

            "https://api.coincap.io/v2/assets/" +
            asset,

            {
                timeout: 10000
            }
        );


    const data =
        response.data?.data;


    if (!data) {

        throw new Error(
            "CoinCap داده‌ای ارائه نکرد."
        );
    }


    return {

        price:
            Number(
                data.priceUsd
            ),

        change24h:
            Number(
                data.changePercent24Hr ||
                0
            ),

        volume24h:
            Number(
                data.volumeUsd24Hr ||
                0
            )
    };
}


/* =========================
   CryptoCompare
========================= */

async function getCryptoCompare(
    symbol
) {

    const base =
        symbol.replace(
            "USDT",
            ""
        );


    const response =
        await axios.get(

            "https://min-api.cryptocompare.com/data/pricemultifull",

            {

                params: {

                    fsyms:
                        base,

                    tsyms:
                        "USD"
                },

                timeout: 10000
            }
        );


    const data =
        response.data
            ?.RAW
            ?.[base]
            ?.USD;


    if (!data) {

        throw new Error(
            "CryptoCompare داده‌ای ارائه نکرد."
        );
    }


    return {

        price:
            Number(
                data.PRICE
            ),

        change24h:
            Number(
                data.CHANGEPCT24HOUR ||
                0
            ),

        volume24h:
            Number(
                data.VOLUME24HOUR ||
                0
            )
    };
}


/* =========================
   دریافت اطلاعات بازار
========================= */

async function getMarketData(
    settings
) {

    const symbol =

        typeof settings === "string"
            ? settings
            : settings?.symbol;


    const coin =
        getCoin(symbol);


    const sources = {};


    let candles = [];


    /* =====================
       CoinGecko
    ===================== */

    try {

        const data =
            await getCoinGecko(
                coin.coinId
            );


        if (
            data.candles &&
            data.candles.length >= 50
        ) {

            candles =
                data.candles;
        }


        sources.coingecko = {

            name:
                "CoinGecko",

            available:
                true,

            price:
                data.price,

            candleCount:
                data.candles.length
        };


    } catch (error) {

        console.error(
            "CoinGecko Error:",
            error.message
        );


        sources.coingecko = {

            name:
                "CoinGecko",

            available:
                false,

            error:
                error.message
        };
    }


    /* =====================
       CoinCap
    ===================== */

    try {

        const data =
            await getCoinCap(
                coin.symbol
            );


        sources.coincap = {

            name:
                "CoinCap",

            available:
                true,

            price:
                data.price,

            change24h:
                data.change24h,

            volume24h:
                data.volume24h
        };


    } catch (error) {

        console.error(
            "CoinCap Error:",
            error.message
        );


        sources.coincap = {

            name:
                "CoinCap",

            available:
                false,

            error:
                error.message
        };
    }


    /* =====================
       CryptoCompare
    ===================== */

    try {

        const data =
            await getCryptoCompare(
                coin.symbol
            );


        sources.cryptocompare = {

            name:
                "CryptoCompare",

            available:
                true,

            price:
                data.price,

            change24h:
                data.change24h,

            volume24h:
                data.volume24h
        };


    } catch (error) {

        console.error(
            "CryptoCompare Error:",
            error.message
        );


        sources.cryptocompare = {

            name:
                "CryptoCompare",

            available:
                false,

            error:
                error.message
        };
    }


    /* =====================
       بررسی نهایی
    ===================== */

    if (
        !candles ||
        candles.length < 50
    ) {

        throw new Error(
            "منبع فعلی داده کندل کافی ارائه نکرد. منابع قیمت فعال هستند، اما برای تحلیل تکنیکال کندل کافی نداریم."
        );
    }


    /* =====================
       قیمت‌ها
    ===================== */

    const prices = {};


    Object.keys(
        sources
    ).forEach(
        key => {

            const source =
                sources[key];


            if (
                source.available &&
                Number.isFinite(
                    source.price
                )
            ) {

                prices[key] =
                    source.price;
            }

        }
    );


    const priceList =
        Object.values(
            prices
        );


    let averagePrice =
        null;


    if (
        priceList.length > 0
    ) {

        averagePrice =

            priceList.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            )
            /
            priceList.length;
    }


    /* =====================
       اختلاف قیمت
    ===================== */

    let priceDifference =
        0;


    if (
        priceList.length >= 2 &&
        averagePrice > 0
    ) {

        const highest =
            Math.max(
                ...priceList
            );


        const lowest =
            Math.min(
                ...priceList
            );


        priceDifference =

            (
                (
                    highest -
                    lowest
                )
                /
                averagePrice
            )
            *
            100;
    }


    return {

        symbol:
            coin.symbol,

        name:
            coin.name,

        candles:
            candles,

        sources:
            sources,

        prices:
            prices,

        averagePrice:
            averagePrice,

        priceDifference:
            priceDifference
    };
}


/* =========================
   فهرست ارزها
========================= */

function getSupportedCoins() {

    return Object.keys(
        COINS
    ).map(
        symbol => {

            return {

                symbol:
                    symbol,

                name:
                    COINS[symbol].name
            };

        }
    );
}


/* =========================
   خروجی
========================= */

module.exports = {

    getMarketData:
        getMarketData,

    getSupportedCoins:
        getSupportedCoins

};