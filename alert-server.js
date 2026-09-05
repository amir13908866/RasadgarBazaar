const express = require("express");
const axios = require("axios");
const twilio = require("twilio");

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
    60 * 1000; // هر 60 ثانیه

const SMS_COOLDOWN =
    15 * 60 * 1000; // 15 دقیقه


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


/* ==================================================
   TWILIO CONFIG
================================================== */

function smsConfigured() {

    return Boolean(

        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_NUMBER &&
        process.env.ALERT_TO_NUMBER

    );
}


/* ==================================================
   SEND SMS
================================================== */

async function sendSMS(message) {

    if (!smsConfigured()) {

        console.log(
            "⚠️ Twilio تنظیم نشده است."
        );

        return false;
    }


    try {

        const client =
            twilio(

                process.env.TWILIO_ACCOUNT_SID,

                process.env.TWILIO_AUTH_TOKEN

            );


        const result =
            await client.messages.create({

                body:
                    message,

                from:
                    process.env.TWILIO_NUMBER,

                to:
                    process.env.ALERT_TO_NUMBER

            });


        console.log(
            "📱 SMS ارسال شد:",
            result.sid
        );


        return true;

    } catch (error) {

        console.error(
            "❌ خطای ارسال SMS:",
            error.message
        );

        return false;
    }
}


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
    ) >= SMS_COOLDOWN;
}


function markAlert(key) {

    lastAlerts.set(
        key,
        Date.now()
    );
}


/* ==================================================
   GET COINGECKO DATA
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


        let volume = 0;


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
   CHECK GOOD SIGNAL
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
       1
       سیگنال تکنیکال قوی
    */

    if (
        strength === "Strong" &&
        (
            signal === "BUY" ||
            signal === "SELL"
        )
    ) {

        /*
           اگر فعالیت بازار
           هم جهت باشد
        */

        if (
            signal === "BUY" &&
            whale?.signal === "BULLISH"
        ) {

            return "STRONG_BUY_ACTIVITY";
        }


        if (
            signal === "SELL" &&
            whale?.signal === "BEARISH"
        ) {

            return "STRONG_SELL_ACTIVITY";
        }


        return "STRONG_SIGNAL";
    }


    /*
       2
       ترکیب سیگنال + فعالیت بازار
    */

    if (
        analysis.combinedConfidence ===
        "HIGH"
    ) {

        return "COMBINED_HIGH";
    }


    /*
       3
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
   CREATE SMS
================================================== */

function createAlertMessage(
    symbol,
    analysis,
    alertType
) {

    const whale =
        analysis.whale;


    let whaleDirection =
        "عادی";


    if (
        whale?.signal ===
        "BULLISH"
    ) {

        whaleDirection =
            "صعودی";

    } else if (
        whale?.signal ===
        "BEARISH"
    ) {

        whaleDirection =
            "نزولی";
    }


    const now =
        new Date();


    let priority =
        "متوسط";


    if (
        alertType ===
        "STRONG_BUY_ACTIVITY" ||

        alertType ===
        "STRONG_SELL_ACTIVITY" ||

        alertType ===
        "COMBINED_HIGH"
    ) {

        priority =
            "بالا";
    }


    if (
        alertType ===
        "EXTREME_ACTIVITY"
    ) {

        priority =
            "خیلی بالا";
    }


    return [

        "🚨 رصدگر بازار",

        `ارز: ${symbol}`,

        `اولویت: ${priority}`,

        `سیگنال: ${
            analysis.signal || "-"
        }`,

        `قدرت: ${
            analysis.strength || "-"
        }`,

        `اعتماد ترکیبی: ${
            analysis.combinedConfidence || "-"
        }`,

        `قیمت: ${
            formatPrice(
                analysis.price
            )
        }`,

        `RSI: ${
            analysis.rsi !== null &&
            analysis.rsi !== undefined

                ? Number(
                    analysis.rsi
                ).toFixed(2)

                : "-"
        }`,

        `امتیاز: ${
            analysis.score ?? "-"
        }`,

        `🐋 فعالیت بازار: ${
            whaleDirection
        }`,

        `شدت فعالیت: ${
            whale?.level || "-"
        }`,

        `نسبت حجم: ${
            whale?.volumeRatio ?? "-"
        }x`,

        `تغییر قیمت: ${
            whale?.priceChange ?? "-"
        }%`,

        `زمان: ${
            now.toLocaleString(
                "fa-IR"
            )
        }`,

        "",

        "⚠️ هشدار تحلیلی است و تضمین حرکت قیمت نیست."

    ].join("\n");
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


        /*
           هشدار مناسب نیست
        */

        if (!alertType) {

            return;
        }


        /*
           جلوگیری از پیامک تکراری
        */

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

            return;
        }


        const message =
            createAlertMessage(

                symbol,

                analysis,

                alertType

            );


        console.log(
            "\n🚨 هشدار پیدا شد:"
        );

        console.log(
            message
        );


        const sent =
            await sendSMS(
                message
            );


        if (sent) {

            markAlert(
                alertKey
            );
        }

    } catch (error) {

        console.error(

            `❌ خطا در ${symbol}:`,

            error.message

        );
    }
}


/* ==================================================
   CHECK ALL COINS
================================================== */

async function checkAllCoins() {

    console.log(
        "\n================================"
    );

    console.log(
        "📡 شروع بررسی بازار"
    );

    console.log(
        new Date().toLocaleString(
            "fa-IR"
        )
    );

    console.log(
        "================================"
    );


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


    console.log(
        "\n✅ بررسی تمام ارزها تمام شد."
    );
}


/* ==================================================
   HEALTH CHECK
================================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            ok:
                true,

            service:
                "Rasadgar Bazaar Alert Server",

            status:
                "online",

            smsConfigured:
                smsConfigured(),

            monitoredCoins:
                Object.keys(
                    COINS
                ).length,

            intervalSeconds:
                CHECK_INTERVAL / 1000,

            message:
                "Market monitoring server is running."

        });

    }
);


/* ==================================================
   HEALTH ENDPOINT
================================================== */

app.get(
    "/health",
    (req, res) => {

        res.json({

            status:
                "ok",

            time:
                new Date().toISOString()

        });

    }
);


/* ==================================================
   MANUAL TEST SMS
================================================== */

app.post(
    "/test-sms",
    async (req, res) => {

        try {

            const sent =
                await sendSMS(

                    "📱 تست رصدگر بازار\n\n" +

                    "سرور پیامک با موفقیت کار می‌کند."

                );


            if (!sent) {

                return res
                    .status(500)
                    .json({

                        success:
                            false,

                        message:
                            "SMS ارسال نشد."

                    });
            }


            res.json({

                success:
                    true,

                message:
                    "SMS ارسال شد."

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
            `📱 SMS: ${
                smsConfigured()
                    ? "ON"
                    : "OFF"
            }`
        );

        console.log(
            "================================"
        );


        /*
           اولین بررسی
        */

        checkAllCoins();


        /*
           بررسی مداوم
        */

        setInterval(

            () => {

                checkAllCoins();

            },

            CHECK_INTERVAL

        );

    }
);