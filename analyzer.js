/* =========================
   EMA
========================= */

function ema(values, period) {

    if (values.length < period) {
        return null;
    }

    const multiplier = 2 / (period + 1);

    let result =
        values
            .slice(0, period)
            .reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {

        result =
            (values[i] - result) *
            multiplier +
            result;
    }

    return result;
}


/* =========================
   RSI
========================= */

function rsi(values, period = 14) {

    if (values.length <= period) {
        return null;
    }

    let gains = 0;
    let losses = 0;

    const start =
        values.length - period;

    for (let i = start; i < values.length; i++) {

        const change =
            values[i] - values[i - 1];

        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    if (losses === 0) {
        return 100;
    }

    const rs =
        gains / losses;

    return 100 - (100 / (1 + rs));
}


/* =========================
   Bollinger
========================= */

function bollinger(
    values,
    period = 20,
    multiplier = 2
) {

    if (values.length < period) {
        return null;
    }

    const data =
        values.slice(-period);

    const middle =
        data.reduce(
            (a, b) => a + b,
            0
        ) / period;

    const variance =
        data.reduce(
            (sum, value) =>
                sum +
                Math.pow(
                    value - middle,
                    2
                ),
            0
        ) / period;

    const deviation =
        Math.sqrt(variance);

    return {

        middle,

        upper:
            middle +
            multiplier * deviation,

        lower:
            middle -
            multiplier * deviation
    };
}


/* =========================
   MACD
========================= */

function macd(values) {

    const ema12 =
        ema(values, 12);

    const ema26 =
        ema(values, 26);

    if (
        ema12 === null ||
        ema26 === null
    ) {
        return null;
    }

    return ema12 - ema26;
}


/* =========================
   ATR
========================= */

function atr(
    values,
    period = 14
) {

    if (values.length <= period) {
        return null;
    }

    let total = 0;

    const start =
        values.length - period;

    for (
        let i = start;
        i < values.length;
        i++
    ) {

        total +=
            Math.abs(
                values[i] -
                values[i - 1]
            );
    }

    return total / period;
}


/* =========================
   گرد کردن قیمت
========================= */

function roundPrice(value) {

    if (!Number.isFinite(value)) {
        return null;
    }

    if (value >= 1000) {
        return Number(
            value.toFixed(2)
        );
    }

    if (value >= 1) {
        return Number(
            value.toFixed(4)
        );
    }

    if (value >= 0.01) {
        return Number(
            value.toFixed(6)
        );
    }

    return Number(
        value.toFixed(8)
    );
}


/* =========================
   🐋 تشخیص فعالیت غیرعادی
========================= */

function detectWhaleActivity(
    candles
) {

    if (
        !Array.isArray(candles) ||
        candles.length < 25
    ) {

        return {

            available: false,

            signal: "NEUTRAL",

            level: "LOW",

            score: 0,

            volumeRatio: null,

            priceChange: null,

            reason:
                "داده کافی برای بررسی فعالیت غیرعادی وجود ندارد."
        };
    }


    const volumes =
        candles
            .map(c => Number(c.volume))
            .filter(
                v =>
                    Number.isFinite(v) &&
                    v >= 0
            );


    if (volumes.length < 20) {

        return {

            available: false,

            signal: "NEUTRAL",

            level: "LOW",

            score: 0,

            volumeRatio: null,

            priceChange: null,

            reason:
                "حجم کافی برای بررسی فعالیت غیرعادی وجود ندارد."
        };
    }


    const lastCandle =
        candles[candles.length - 1];


    const currentVolume =
        Number(
            lastCandle.volume
        );


    const previousVolumes =
        volumes.slice(-21, -1);


    const averageVolume =
        previousVolumes.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        previousVolumes.length;


    if (
        !Number.isFinite(
            averageVolume
        ) ||
        averageVolume <= 0
    ) {

        return {

            available: false,

            signal: "NEUTRAL",

            level: "LOW",

            score: 0,

            volumeRatio: null,

            priceChange: null,

            reason:
                "میانگین حجم معتبر نیست."
        };
    }


    const volumeRatio =
        currentVolume /
        averageVolume;


    const previousClose =
        Number(
            candles[
                candles.length - 2
            ].close
        );


    const currentClose =
        Number(
            lastCandle.close
        );


    const priceChange =
        previousClose !== 0
            ? (
                (
                    currentClose -
                    previousClose
                )
                /
                previousClose
            ) *
            100
            : 0;


    let score = 0;

    const reasons = [];


    /* حجم غیرعادی */

    if (volumeRatio >= 3) {

        score += 4;

        reasons.push(
            "حجم فعلی بیش از ۳ برابر میانگین اخیر است."
        );

    } else if (volumeRatio >= 2) {

        score += 3;

        reasons.push(
            "حجم فعلی بیش از ۲ برابر میانگین اخیر است."
        );

    } else if (volumeRatio >= 1.5) {

        score += 2;

        reasons.push(
            "حجم بازار بالاتر از حالت عادی است."
        );
    }


    /* حرکت قیمت */

    if (priceChange >= 1) {

        score += 2;

        reasons.push(
            "همزمان با افزایش حجم، قیمت حرکت صعودی قابل توجهی داشته است."
        );

    } else if (priceChange <= -1) {

        score += 2;

        reasons.push(
            "همزمان با افزایش حجم، قیمت حرکت نزولی قابل توجهی داشته است."
        );

    } else if (
        Math.abs(priceChange) >= 0.5
    ) {

        score += 1;

        reasons.push(
            "قیمت همراه با افزایش فعالیت بازار حرکت کرده است."
        );
    }


    let signal =
        "NEUTRAL";

    let level =
        "LOW";


    if (
        volumeRatio >= 2 &&
        priceChange >= 0.5
    ) {

        signal =
            "BULLISH";

        if (score >= 6) {
            level = "EXTREME";
        } else if (score >= 5) {
            level = "HIGH";
        } else {
            level = "MEDIUM";
        }


    } else if (
        volumeRatio >= 2 &&
        priceChange <= -0.5
    ) {

        signal =
            "BEARISH";

        if (score >= 6) {
            level = "EXTREME";
        } else if (score >= 5) {
            level = "HIGH";
        } else {
            level = "MEDIUM";
        }


    } else if (
        volumeRatio >= 1.5
    ) {

        signal =
            "NEUTRAL";

        level =
            score >= 4
                ? "MEDIUM"
                : "LOW";
    }


    if (reasons.length === 0) {

        reasons.push(
            "فعالیت غیرعادی قابل توجهی مشاهده نشد."
        );
    }


    const signalTime =
        new Date();


    return {

        available: true,

        signal: signal,

        level: level,

        score: score,

        volumeRatio:
            Number(
                volumeRatio.toFixed(2)
            ),

        averageVolume:
            averageVolume,

        currentVolume:
            currentVolume,

        priceChange:
            Number(
                priceChange.toFixed(3)
            ),

        signalTime:
            signalTime.toLocaleString(
                "fa-IR"
            ),

        signalTimestamp:
            signalTime.getTime(),

        reasons: reasons,

        reason:
            reasons.join(" ")
    };
}


/* =========================
   ترکیب تکنیکال + فعالیت بازار
========================= */

function combineSignals(
    technicalSignal,
    technicalStrength,
    whale
) {

    let combined =
        "WAIT";

    let confidence =
        "LOW";


    if (
        technicalSignal === "BUY" &&
        whale.signal === "BULLISH"
    ) {

        combined =
            "BUY + ACTIVITY";

        confidence =
            whale.level === "EXTREME" ||
            whale.level === "HIGH"
                ? "HIGH"
                : "MEDIUM";


    } else if (
        technicalSignal === "SELL" &&
        whale.signal === "BEARISH"
    ) {

        combined =
            "SELL + ACTIVITY";

        confidence =
            whale.level === "EXTREME" ||
            whale.level === "HIGH"
                ? "HIGH"
                : "MEDIUM";


    } else if (
        technicalSignal === "BUY" &&
        whale.signal === "BEARISH"
    ) {

        combined =
            "CONFLICT";

        confidence =
            "LOW";


    } else if (
        technicalSignal === "SELL" &&
        whale.signal === "BULLISH"
    ) {

        combined =
            "CONFLICT";

        confidence =
            "LOW";


    } else if (
        technicalSignal !== "WAIT"
    ) {

        combined =
            technicalSignal;

        confidence =
            technicalStrength === "Strong"
                ? "MEDIUM"
                : "LOW";
    }


    return {

        signal:
            combined,

        confidence:
            confidence
    };
}


/* =========================
   ساخت پلن تحلیلی
========================= */

function createTradePlan(
    price,
    atrValue,
    signal,
    strength
) {

    if (
        !Number.isFinite(price) ||
        !Number.isFinite(atrValue) ||
        signal === "WAIT"
    ) {

        return {

            available: false,

            signal: signal,

            reason:
                "سیگنال قابل معامله وجود ندارد."
        };
    }


    const stopDistance =
        Math.max(
            atrValue * 1.5,
            price * 0.005
        );


    const rewardDistance =
        stopDistance * 2;


    let entryPrice;
    let stopLoss;
    let takeProfit;


    if (signal === "BUY") {

        entryPrice =
            price;

        stopLoss =
            price -
            stopDistance;

        takeProfit =
            price +
            rewardDistance;


    } else {

        entryPrice =
            price;

        stopLoss =
            price +
            stopDistance;

        takeProfit =
            price -
            rewardDistance;
    }


    const signalTime =
        new Date();


    return {

        available: true,

        signal: signal,

        strength: strength,

        entryPrice:
            roundPrice(
                entryPrice
            ),

        stopLoss:
            roundPrice(
                stopLoss
            ),

        takeProfit:
            roundPrice(
                takeProfit
            ),

        exitPrice:
            roundPrice(
                takeProfit
            ),

        riskDistance:
            roundPrice(
                stopDistance
            ),

        rewardDistance:
            roundPrice(
                rewardDistance
            ),

        riskReward:
            "1 : 2",

        signalTime:
            signalTime.toLocaleString(
                "fa-IR"
            ),

        signalTimestamp:
            signalTime.getTime(),

        status:
            "نیازمند تأیید"
    };
}


/* =========================
   تحلیل اصلی
========================= */

function analyze(
    candles,
    settings = {}
) {

    if (
        !candles ||
        candles.length < 50
    ) {

        throw new Error(
            "داده کافی برای تحلیل وجود ندارد."
        );
    }


    const closes =
        candles.map(
            candle =>
                Number(candle.close)
        );


    const price =
        closes[
            closes.length - 1
        ];


    /* =====================
       اندیکاتورها
    ===================== */

    const ema20 =
        ema(closes, 20);

    const ema50 =
        ema(closes, 50);

    const ema200 =
        ema(closes, 200);

    const rsiValue =
        rsi(
            closes,
            14
        );

    const bb =
        bollinger(
            closes,
            20,
            2
        );

    const macdValue =
        macd(closes);

    const atrValue =
        atr(
            closes,
            14
        );


    /* =====================
       امتیاز تکنیکال
    ===================== */

    let score = 0;

    const reasons = [];


    if (ema20 !== null) {

        if (price > ema20) {

            score += 1;

            reasons.push(
                "قیمت بالاتر از EMA20 است."
            );

        } else {

            score -= 1;

            reasons.push(
                "قیمت پایین‌تر از EMA20 است."
            );
        }
    }


    if (ema50 !== null) {

        if (price > ema50) {

            score += 1;

            reasons.push(
                "قیمت بالاتر از EMA50 است."
            );

        } else {

            score -= 1;

            reasons.push(
                "قیمت پایین‌تر از EMA50 است."
            );
        }
    }


    if (ema200 !== null) {

        if (price > ema200) {

            score += 1;

            reasons.push(
                "قیمت بالاتر از EMA200 است."
            );

        } else {

            score -= 1;

            reasons.push(
                "قیمت پایین‌تر از EMA200 است."
            );
        }
    }


    if (rsiValue !== null) {

        if (rsiValue < 30) {

            score += 2;

            reasons.push(
                "RSI در محدوده اشباع فروش است."
            );

        } else if (
            rsiValue > 70
        ) {

            score -= 2;

            reasons.push(
                "RSI در محدوده اشباع خرید است."
            );

        } else if (
            rsiValue >= 50
        ) {

            score += 1;

            reasons.push(
                "RSI بالاتر از 50 است."
            );

        } else {

            score -= 1;

            reasons.push(
                "RSI پایین‌تر از 50 است."
            );
        }
    }


    if (macdValue !== null) {

        if (macdValue > 0) {

            score += 1;

            reasons.push(
                "MACD مثبت است."
            );

        } else {

            score -= 1;

            reasons.push(
                "MACD منفی است."
            );
        }
    }


    if (bb !== null) {

        if (
            price <= bb.lower
        ) {

            score += 2;

            reasons.push(
                "قیمت نزدیک باند پایینی بولینگر است."
            );

        } else if (
            price >= bb.upper
        ) {

            score -= 2;

            reasons.push(
                "قیمت نزدیک باند بالایی بولینگر است."
            );
        }
    }


    /* =====================
       سیگنال تکنیکال
    ===================== */

    let signal =
        "WAIT";

    let strength =
        "Weak";


    if (score >= 4) {

        signal =
            "BUY";

        strength =
            "Strong";

    } else if (score >= 2) {

        signal =
            "BUY";

        strength =
            "Medium";

    } else if (score <= -4) {

        signal =
            "SELL";

        strength =
            "Strong";

    } else if (score <= -2) {

        signal =
            "SELL";

        strength =
            "Medium";
    }


    /* =====================
       روند
    ===================== */

    let trend =
        "SIDEWAYS";


    if (
        ema20 !== null &&
        ema50 !== null
    ) {

        if (
            price > ema20 &&
            ema20 > ema50
        ) {

            trend =
                "UPTREND";

        } else if (
            price < ema20 &&
            ema20 < ema50
        ) {

            trend =
                "DOWNTREND";
        }
    }


    /* =====================
       🐋 Whale Activity
    ===================== */

    const whale =
        detectWhaleActivity(
            candles
        );


    /* =====================
       ترکیب
    ===================== */

    const combined =
        combineSignals(
            signal,
            strength,
            whale
        );


    /* =====================
       پلن
    ===================== */

    const tradePlan =
        createTradePlan(
            price,
            atrValue,
            signal,
            strength
        );


    /* =====================
       خروجی
    ===================== */

    return {

        price,

        ema20,

        ema50,

        ema200,

        rsi:
            rsiValue,

        macd:
            macdValue,

        atr:
            atrValue,

        bollinger:
            bb,

        score,

        signal,

        strength,

        trend,

        reasons,

        whale,

        combinedSignal:
            combined.signal,

        combinedConfidence:
            combined.confidence,

        tradePlan,

        settings: {

            marketType:
                settings.marketType ||
                "spot",

            style:
                settings.style ||
                "short-term",

            timeframe:
                settings.timeframe ||
                "1h"
        }
    };
}


/* =========================
   خروجی
========================= */

module.exports = {

    analyze
};