const express = require("express");
const axios = require("axios");
const path = require("path");

const {
    analyze
} = require("./analyzer.js");


/* ==================================================
   SERVER
================================================== */

const app = express();

app.use(express.json());

const PORT =
    Number(process.env.PORT) || 10000;


/* ==================================================
   SETTINGS
================================================== */

const CHECK_INTERVAL =
    60 * 1000;

const ALERT_COOLDOWN =
    15 * 60 * 1000;


/* ==================================================
   COINS
================================================== */

const COINS = {

    BTCUSDT: "bitcoin",

    ETHUSDT: "ethereum",

    SOLUSDT: "solana",

    XRPUSDT: "ripple",

    BNBUSDT: "binancecoin",

    ADAUSDT: "cardano",

    DOGEUSDT: "dogecoin",

    AVAXUSDT: "avalanche-2",

    DOTUSDT: "polkadot",

    LINKUSDT: "chainlink",

    LTCUSDT: "litecoin",

    TRXUSDT: "tron",

    SHIBUSDT: "shiba-inu"

};


/* ==================================================
   ALERT MEMORY
================================================== */

const lastAlerts =
    new Map();

const recentAlerts =
    [];

const MAX_ALERTS =
    100;


/* ==================================================
   FORMAT PRICE
================================================== */

function formatPrice(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(number)
    ) {

        return "-";
    }

    return number.toLocaleString(
        "en-US",
        {
            maximumFractionDigits: 8
        }
    );
}


/* ==================================================
   FORMAT TIME
================================================== */

function formatTime() {

    return new Date()
        .toLocaleString(
            "fa-IR"
        );
}


/* ==================================================
   ALERT COOLDOWN
================================================== */

function canSendAlert(key) {

    const previous =
        lastAlerts.get(key);

    if (!previous) {

        return true;
    }

    return (
        Date.now() -
        previous
    ) >= ALERT_COOLDOWN;
}


function markAlert(key) {

    lastAlerts.set(
        key,
        Date.now()
    );
}


/* ==================================================
   COINGECKO DATA
================================================== */

async function getCoinData(
    coinId
) {

    const response =
        await axios.get(

            `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart`,

            {

                params: {

                    vs_currency:
                        "usd",

                    days:
                        30

                },

                timeout:
                    20000

            }

        );


    const data =
        response.data;


    if (
        !data ||
        !Array.isArray(
            data.prices
        )
    ) {

        throw new Error(
            "اطلاعات بازار دریافت نشد."
        );
    }


    const candles = [];


    for (
        let i = 0;
        i < data.prices.length;
        i++
    ) {

        const current =
            Number(
                data.prices[i][1]
            );


        if (
            !Number.isFinite(
                current
            )
        ) {

            continue;
        }


        const previous =
            i > 0

                ? Number(
                    data.prices[i - 1][1]
                )

                : current;


        let volume =
            0;


        if (
            Array.isArray(
                data.total_volumes
            ) &&
            data.total_volumes[i]
        ) {

            volume =
                Number(
                    data.total_volumes[i][1]
                ) || 0;
        }


        candles.push({

            time:
                Number(
                    data.prices[i][0]
                ),

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
                volume

        });
    }


    if (
        candles.length < 50
    ) {

        throw new Error(
            "کندل کافی دریافت نشد."
        );
    }


    return candles;
}


/* ==================================================
   DETERMINE ALERT TYPE
================================================== */

function getAlertType(
    analysis
) {

    if (!analysis) {

        return null;
    }


    const signal =
        analysis.signal;

    const strength =
        analysis.strength;

    const whale =
        analysis.whale;


    /*
       سیگنال قوی BUY
       + فعالیت صعودی
    */

    if (
        strength === "Strong" &&
        signal === "BUY" &&
        whale?.signal === "BULLISH"
    ) {

        return "STRONG_BUY_ACTIVITY";
    }


    /*
       سیگنال قوی SELL
       + فعالیت نزولی
    */

    if (
        strength === "Strong" &&
        signal === "SELL" &&
        whale?.signal === "BEARISH"
    ) {

        return "STRONG_SELL_ACTIVITY";
    }


    /*
       سیگنال تکنیکال قوی
    */

    if (
        strength === "Strong" &&
        (
            signal === "BUY" ||
            signal === "SELL"
        )
    ) {

        return "STRONG_SIGNAL";
    }


    /*
       اعتماد ترکیبی بالا
    */

    if (
        analysis.combinedConfidence ===
        "HIGH"
    ) {

        return "COMBINED_HIGH";
    }


    /*
       فعالیت بسیار شدید
    */

    if (
        whale &&
        whale.available &&
        whale.level === "EXTREME"
    ) {

        return "EXTREME_ACTIVITY";
    }


    return null;
}


/* ==================================================
   PRIORITY
================================================== */

function getPriority(
    alertType
) {

    switch (
        alertType
    ) {

        case "STRONG_BUY_ACTIVITY":

        case "STRONG_SELL_ACTIVITY":

        case "COMBINED_HIGH":

            return "HIGH";


        case "EXTREME_ACTIVITY":

            return "VERY_HIGH";


        case "STRONG_SIGNAL":

            return "MEDIUM";


        default:

            return "LOW";
    }
}


/* ==================================================
   CREATE ALERT
================================================== */

function createAlert(
    symbol,
    analysis,
    alertType
) {

    const whale =
        analysis.whale;


    let whaleDirection =
        "NEUTRAL";


    if (
        whale?.signal ===
        "BULLISH"
    ) {

        whaleDirection =
            "BULLISH";

    } else if (
        whale?.signal ===
        "BEARISH"
    ) {

        whaleDirection =
            "BEARISH";
    }


    return {

        id:
            `${symbol}_${Date.now()}`,

        time:
            new Date().toISOString(),

        timeLocal:
            formatTime(),

        symbol:
            symbol,

        alertType:
            alertType,

        priority:
            getPriority(
                alertType
            ),

        signal:
            analysis.signal || "-",

        strength:
            analysis.strength || "-",

        combinedConfidence:
            analysis.combinedConfidence || "-",

        price:
            Number(
                analysis.price
            ) || null,

        priceFormatted:
            formatPrice(
                analysis.price
            ),

        score:
            analysis.score ?? null,

        rsi:
            analysis.rsi ?? null,

        trend:
            analysis.trend || "-",

        whale: {

            available:
                whale?.available || false,

            signal:
                whaleDirection,

            level:
                whale?.level || "-",

            score:
                whale?.score ?? null,

            volumeRatio:
                whale?.volumeRatio ?? null,

            priceChange:
                whale?.priceChange ?? null,

            signalTime:
                whale?.signalTime || null

        },

        tradePlan:
            analysis.tradePlan || null,

        reasons:
            Array.isArray(
                analysis.reasons
            )
                ? analysis.reasons
                : []

    };
}


/* ==================================================
   SAVE ALERT
================================================== */

function saveAlert(
    alert
) {

    recentAlerts.unshift(
        alert
    );


    if (
        recentAlerts.length >
        MAX_ALERTS
    ) {

        recentAlerts.pop();
    }
}


/* ==================================================
   CHECK ONE COIN
================================================== */

async function checkCoin(
    symbol,
    coinId
) {

    try {

        console.log(
            `🔎 بررسی ${symbol} ...`
        );


        const candles =
            await getCoinData(
                coinId
            );


        const analysis =
            analyze(

                candles,

                {

                    symbol:
                        symbol,

                    marketType:
                        "spot",

                    style:
                        "short-term",

                    timeframe:
                        "1h"

                }

            );


        const alertType =
            getAlertType(
                analysis
            );


        console.log(

            `${symbol} | ` +

            `Signal=${analysis.signal} | ` +

            `Strength=${analysis.strength} | ` +

            `Confidence=${
                analysis.combinedConfidence || "-"
            } | ` +

            `Activity=${
                analysis.whale?.level || "-"
            }`

        );


        if (!alertType) {

            return null;
        }


        const alertKey =
            `${symbol}_${alertType}`;


        if (
            !canSendAlert(
                alertKey
            )
        ) {

            console.log(
                `⏳ هشدار تکراری ${symbol}`
            );

            return null;
        }


        const alert =
            createAlert(

                symbol,

                analysis,

                alertType

            );


        saveAlert(
            alert
        );


        markAlert(
            alertKey
        );


        console.log(
            "\n🚨 هشدار جدید!"
        );


        console.log(
            JSON.stringify(
                alert,
                null,
                2
            )
        );


        return alert;

    } catch (error) {

        console.error(

            `❌ خطا در ${symbol}:`,

            error.message

        );


        return null;
    }
}


/* ==================================================
   CHECK ALL COINS
================================================== */

let isChecking =
    false;


async function checkAllCoins() {

    if (isChecking) {

        console.log(
            "⏳ بررسی قبلی هنوز تمام نشده."
        );

        return;
    }


    isChecking =
        true;


    console.log(
        "\n================================"
    );

    console.log(
        "📡 شروع بررسی بازار"
    );

    console.log(
        formatTime()
    );

    console.log(
        "================================"
    );


    try {

        for (
            const [
                symbol,
                coinId
            ]
            of Object.entries(
                COINS
            )
        ) {

            await checkCoin(
                symbol,
                coinId
            );

        }

    } finally {

        isChecking =
            false;
    }


    console.log(
        "\n✅ بررسی تمام ارزها تمام شد."
    );
}


/* ==================================================
   DASHBOARD
================================================== */

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "dashboard.html"
            )
        );

    }
);


/* ==================================================
   API STATUS
================================================== */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            ok:
                true,

            service:
                "Rasadgar Bazaar Alert Server",

            status:
                "online",

            sms:
                false,

            monitoredCoins:
                Object.keys(
                    COINS
                ).length,

            intervalSeconds:
                CHECK_INTERVAL / 1000,

            recentAlerts:
                recentAlerts.length,

            lastCheck:
                new Date().toISOString()

        });

    }
);


/* ==================================================
   HEALTH
================================================== */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "ok",

            online:
                true,

            time:
                new Date().toISOString()

        });

    }
);


/* ==================================================
   ALL ALERTS
================================================== */

app.get(
    "/alerts",
    (req, res) => {

        res.json({

            success:
                true,

            count:
                recentAlerts.length,

            alerts:
                recentAlerts

        });

    }
);


/* ==================================================
   LATEST ALERT
================================================== */

app.get(
    "/alerts/latest",
    (req, res) => {

        if (
            recentAlerts.length === 0
        ) {

            return res.json({

                success:
                    true,

                alert:
                    null,

                message:
                    "هنوز هشداری ثبت نشده."

            });
        }


        res.json({

            success:
                true,

            alert:
                recentAlerts[0]

        });

    }
);


/* ==================================================
   COINS
================================================== */

app.get(
    "/coins",
    (req, res) => {

        res.json({

            success:
                true,

            count:
                Object.keys(
                    COINS
                ).length,

            coins:
                Object.keys(
                    COINS
                )

        });

    }
);


/* ==================================================
   MANUAL CHECK
================================================== */

app.post(
    "/check",
    async (req, res) => {

        try {

            await checkAllCoins();


            res.json({

                success:
                    true,

                message:
                    "بررسی بازار انجام شد.",

                alerts:
                    recentAlerts.length

            });

        } catch (error) {

            res
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        error.message

                });

        }

    }
);


/* ==================================================
   START SERVER
================================================== */

app.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            "================================"
        );

        console.log(
            "🚀 Rasadgar Alert Server"
        );

        console.log(
            `🌐 Port: ${PORT}`
        );

        console.log(
            "🌍 Host: 0.0.0.0"
        );

        console.log(
            `🐋 Coins: ${
                Object.keys(
                    COINS
                ).length
            }`
        );

        console.log(
            `⏱ Check: ${
                CHECK_INTERVAL / 1000
            } seconds`
        );

        console.log(
            "📱 SMS: OFF"
        );

        console.log(
            "================================"
        );


        /*
           اولین بررسی
        */

        checkAllCoins();


        /*
           بررسی خودکار
        */

        setInterval(

            () => {

                checkAllCoins();

            },

            CHECK_INTERVAL

        );

    }
);
