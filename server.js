const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const AVIATION_KEY = 'ea0ff3aa76278ec533a664129ec4dd0f';
const GEMINI_KEY = 'AIzaSyDs_Xrf1DgEnJk5ORCLg2VaNJuQrybkf5E';
const DEFAULT_BUDGET = 3000000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const AIRPORT_ALIASES = {
    HAN: ['han', 'ha noi', 'hanoi'],
    SGN: ['sgn', 'ho chi minh', 'tp hcm', 'tphcm', 'sai gon', 'saigon'],
    DAD: ['dad', 'da nang', 'danang'],
    SIN: ['sin', 'singapore'],
    BKK: ['bkk', 'bangkok', 'thai lan', 'thailand']
};

const COUNTRY_DEFAULT_AIRPORTS = {
    vietnam: { origin: 'HAN', destination: 'SGN' },
    singapore: { origin: 'SIN', destination: 'SIN' },
    thailand: { origin: 'BKK', destination: 'BKK' }
};

const AIRLINE_BOOKING_LINKS = {
    'Vietnam Airlines': 'https://www.vietnamairlines.com/vn/vi/home',
    'Singapore Airlines': 'https://www.singaporeair.com/vi_VN/vn/home',
    'Scoot': 'https://www.flyscoot.com/',
    'VietJet Air': 'https://www.vietjetair.com/vi',
    'Thai Airways': 'https://www.thaiairways.com/',
    'Bamboo Airways': 'https://www.bambooairways.com/vn/en/air-tickets/flights-from-vietnam/'
};

const AIRPORT_ROUTE_META = {
    HAN: { slug: 'hanoi' },
    SGN: { slug: 'ho-chi-minh-city' },
    DAD: { slug: 'da-nang' },
    SIN: { slug: 'singapore' },
    BKK: { slug: 'bangkok' }
};

const AIRPORT_DISPLAY_META = {
    HAN: {
        airportCode: 'HAN',
        city: 'Hà Nội',
        country: 'Việt Nam',
        label: 'Hà Nội',
        fallbackOverview: 'Hà Nội có nhịp sống nhanh, nhiều khu phố cổ và món ăn đường phố để thử.'
    },
    SGN: {
        airportCode: 'SGN',
        city: 'TP. Hồ Chí Minh',
        country: 'Việt Nam',
        label: 'TP. Hồ Chí Minh',
        fallbackOverview: 'TP. Hồ Chí Minh sôi động, hợp với lịch trình linh hoạt và khám phá ẩm thực.'
    },
    DAD: {
        airportCode: 'DAD',
        city: 'Đà Nẵng',
        country: 'Việt Nam',
        label: 'Đà Nẵng',
        fallbackOverview: 'Đà Nẵng gần biển, dễ di chuyển và hợp với các chuyến đi nghỉ ngắn ngày.'
    },
    SIN: {
        airportCode: 'SIN',
        city: 'Singapore',
        country: 'Singapore',
        label: 'Singapore',
        fallbackOverview: 'Singapore gọn gàng, dễ di chuyển bằng MRT và có nhiều điểm tham quan miễn phí hoặc chi phí vừa phải.'
    },
    BKK: {
        airportCode: 'BKK',
        city: 'Bangkok',
        country: 'Thái Lan',
        label: 'Bangkok',
        fallbackOverview: 'Bangkok nhộn nhịp, nhiều chợ đêm, đền chùa và khu mua sắm hợp với người đi ngân sách.'
    }
};

const VIETNAM_AIRLINES_ROUTE_LINKS = {
    'HAN-SIN': 'https://www.vietnamairlines.com/en-vn/flights-from-hanoi-to-singapore',
    'SGN-SIN': 'https://www.vietnamairlines.com/en-vn/flights-from-ho-chi-minh-city-to-singapore',
    'HAN-BKK': 'https://www.vietnamairlines.com/en-vn/flights-from-hanoi-to-bangkok',
    'SGN-BKK': 'https://www.vietnamairlines.com/en-vn/flights-from-ho-chi-minh-city-to-bangkok',
    'HAN-SGN': 'https://www.vietnamairlines.com/en-vn/flights-from-hanoi-to-ho-chi-minh-city',
    'SGN-HAN': 'https://www.vietnamairlines.com/en-vn/flights-from-ho-chi-minh-city-to-hanoi'
};

const BAMBOO_ROUTE_LINKS = {
    'HAN-SGN': 'https://www.bambooairways.com/th/en/air-tickets/flights-from-ha-noi-to-ho-chi-minh-city/',
    'SGN-HAN': 'https://www.bambooairways.com/vn/en/air-tickets/flights-from-ho-chi-minh-city-to-ha-noi/'
};

const DOMESTIC_AIRPORT_CODES = ['HAN', 'SGN', 'DAD'];

const DEMO_ROUTE_DURATIONS = {
    'HAN-SIN': 195,
    'SIN-HAN': 195,
    'SGN-SIN': 125,
    'SIN-SGN': 125,
    'HAN-BKK': 120,
    'BKK-HAN': 120,
    'SGN-BKK': 100,
    'BKK-SGN': 100,
    'HAN-SGN': 130,
    'SGN-HAN': 130,
    'HAN-DAD': 80,
    'DAD-HAN': 80,
    'SGN-DAD': 90,
    'DAD-SGN': 90
};

function normalizeVietnamese(text = '') {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .toLowerCase();
}

function detectAirport(fragment = '') {
    const normalized = normalizeVietnamese(fragment);
    for (const [code, aliases] of Object.entries(AIRPORT_ALIASES)) {
        if (aliases.some(alias => normalized.includes(alias))) {
            return code;
        }
    }
    return null;
}

function detectCountry(fragment = '') {
    const normalized = normalizeVietnamese(fragment);
    if (normalized.includes('viet nam') || normalized.includes('vietnam')) return 'vietnam';
    if (normalized.includes('singapore')) return 'singapore';
    if (normalized.includes('thai lan') || normalized.includes('thailand')) return 'thailand';
    return null;
}

function resolveLocation(fragment = '', role = 'origin') {
    const airport = detectAirport(fragment);
    if (airport) return airport;

    const country = detectCountry(fragment);
    if (!country) return null;

    return COUNTRY_DEFAULT_AIRPORTS[country]?.[role] || null;
}

function sanitizeIata(code, role = 'origin') {
    if (!code || typeof code !== 'string') return null;
    const normalized = code.trim().toUpperCase();
    if (AIRPORT_ALIASES[normalized]) return normalized;

    if (normalized === 'VN' || normalized === 'VIETNAM') {
        return COUNTRY_DEFAULT_AIRPORTS.vietnam[role];
    }
    if (normalized === 'SG' || normalized === 'SINGAPORE') {
        return COUNTRY_DEFAULT_AIRPORTS.singapore[role];
    }
    if (normalized === 'TH' || normalized === 'THAILAND') {
        return COUNTRY_DEFAULT_AIRPORTS.thailand[role];
    }
    return null;
}

function isBroadLocation(fragment = '') {
    const normalized = normalizeVietnamese(fragment);
    return (
        normalized.includes('viet nam') ||
        normalized.includes('vietnam') ||
        normalized === 'vn' ||
        normalized.includes('singapore') ||
        normalized === 'sing' ||
        normalized.includes('thai lan') ||
        normalized.includes('thailand')
    );
}

function getSuggestedSearchDateString() {
    return addDaysToDateString(getTodayDateString(), 8);
}

function formatDateForPrompt(dateString) {
    return formatDateForMessage(dateString);
}

function buildDefaultClarificationPrompts() {
    const suggestedDate = formatDateForPrompt(getSuggestedSearchDateString());
    return [
        `Toi muon bay tu Ha Noi den Singapore ngay ${suggestedDate}, ngan sach 4 trieu`,
        `Toi muon bay tu TP. Ho Chi Minh den Bangkok ngay ${suggestedDate}, ngan sach 3 trieu`,
        `Toi muon bay tu Da Nang den Ha Noi ngay ${suggestedDate}, ngan sach 2 trieu`
    ];
}

function buildAmbiguousPromptMessage() {
    return `Yeu cau cua ban con mo ho. Vui long cung cap them san bay hoac noi ban o gan nhat, ngay gio bay va ngan sach. Neu khong ghi ngan sach, he thong se mac dinh 3.000.000 VND. Vi du: "Toi muon bay tu Ha Noi den Singapore ngay ${formatDateForPrompt(getSuggestedSearchDateString())}, ngan sach 4 trieu".`;
}

function formatBudgetForPrompt(budget) {
    if (!budget) return '3 trieu';
    const million = budget / 1000000;
    if (Number.isInteger(million)) return `${million} trieu`;
    return `${budget.toLocaleString('vi-VN')} VND`;
}

function buildVietnamAirportClarification(text, parsed) {
    const normalized = normalizeVietnamese(text);
    const originMatch = /tu\s+(.+?)\s+den/.exec(normalized);
    const destinationMatch = /den\s+(.+?)(?:\s+ngay|\s*,|\s+voi|\s+ngan sach|$)/.exec(normalized);
    const dateText = extractDateText(text) || formatDateForPrompt(getSuggestedSearchDateString());
    const budgetText = formatBudgetForPrompt(parsed.budget || DEFAULT_BUDGET);
    const airports = [
        { code: 'HAN', city: 'Ha Noi' },
        { code: 'SGN', city: 'TP. Ho Chi Minh' },
        { code: 'DAD', city: 'Da Nang' }
    ];

    if (originMatch && detectCountry(originMatch[1]) === 'vietnam') {
        const destinationText = parsed.destination || 'SIN';
        const destinationLabel = destinationText === 'SIN' ? 'Singapore' : destinationText;
        return {
            needsAirportChoice: true,
            message: 'Ban dang ghi diem di la Viet Nam. Ban muon khoi hanh gan san bay nao nhat?',
            suggestionPrompts: airports.map(airport =>
                `Toi muon bay tu ${airport.city} den ${destinationLabel} ngay ${dateText}, ngan sach ${budgetText}`
            )
        };
    }

    if (destinationMatch && detectCountry(destinationMatch[1]) === 'vietnam') {
        const originText = parsed.origin || 'SIN';
        const originLabel = originText === 'SIN' ? 'Singapore' : originText;
        return {
            needsAirportChoice: true,
            message: 'Ban dang ghi diem den la Viet Nam. Ban muon ha canh o san bay nao?',
            suggestionPrompts: airports.map(airport =>
                `Toi muon bay tu ${originLabel} den ${airport.city} ngay ${dateText}, ngan sach ${budgetText}`
            )
        };
    }

    return null;
}

function extractDateText(text) {
    const fullDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/);
    if (fullDateMatch) return fullDateMatch[0];

    const shortDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    if (!shortDateMatch) return null;

    const currentYear = new Date().getFullYear();
    return `${shortDateMatch[1].padStart(2, '0')}/${shortDateMatch[2].padStart(2, '0')}/${currentYear}`;
}

function analyzeTextClarity(text, parsed) {
    const normalized = normalizeVietnamese(text);
    const hasDate = Boolean(extractDateText(text));
    const hasBudget = /(\d+(?:\.\d+)?)(?:m(\d+))?\s*(trieu|tr|m|ngan|k|vnd|d)?/i.test(normalized);

    const needsMoreDetails =
        !parsed.origin ||
        !parsed.destination ||
        !hasDate;

    return {
        needsMoreDetails,
        hasBudget
    };
}

function getDateString(input) {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return parseDateString(input) ? input : null;
    }

    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    return formatLocalDateString(date);
}

function getAirlineBookingLink(airlineName) {
    if (!airlineName) return null;
    const exactLink = AIRLINE_BOOKING_LINKS[airlineName];
    if (exactLink) return exactLink;

    const name = airlineName.toLowerCase();
    if (name.includes('vietnam airlines')) return AIRLINE_BOOKING_LINKS['Vietnam Airlines'];
    if (name.includes('vietjet')) return AIRLINE_BOOKING_LINKS['VietJet Air'];
    if (name.includes('bamboo')) return AIRLINE_BOOKING_LINKS['Bamboo Airways'];
    if (name.includes('thai airways')) return AIRLINE_BOOKING_LINKS['Thai Airways'];
    if (name.includes('singapore airlines')) return AIRLINE_BOOKING_LINKS['Singapore Airlines'];
    if (name.includes('scoot')) return AIRLINE_BOOKING_LINKS['Scoot'];
    return null;
}

function getAirlineRouteLink(airlineName, from, to) {
    if (!airlineName || !from || !to) return null;
    const routeKey = `${from}-${to}`;
    const name = airlineName.toLowerCase();

    if (name.includes('vietnam airlines')) {
        return VIETNAM_AIRLINES_ROUTE_LINKS[routeKey] || null;
    }
    if (name.includes('bamboo')) {
        return BAMBOO_ROUTE_LINKS[routeKey] || null;
    }

    const fromMeta = AIRPORT_ROUTE_META[from];
    const toMeta = AIRPORT_ROUTE_META[to];
    if (!fromMeta || !toMeta) return null;

    if (name.includes('singapore airlines')) {
        return `https://www.singaporeair.com/en-vn/flights-from-${fromMeta.slug}-to-${toMeta.slug}`;
    }
    if (name.includes('scoot')) {
        return `https://www.flyscoot.com/flights/en/flights-from-${fromMeta.slug}-to-${toMeta.slug}`;
    }
    if (name.includes('thai airways')) {
        return `https://www.thaiairways.com/flights/en/flights-from-${fromMeta.slug}-to-${toMeta.slug}`;
    }
    return null;
}

function buildRequestLog(payload) {
    const log = { ...payload };
    if (!log.text) delete log.text;
    if (!log.returnDate) delete log.returnDate;
    if (!log.legs || !Array.isArray(log.legs) || log.legs.length === 0) delete log.legs;
    return log;
}

function getAirportDisplayMeta(code = '') {
    return AIRPORT_DISPLAY_META[code] || {
        airportCode: code,
        city: code,
        country: 'Quốc tế',
        label: code,
        fallbackOverview: `Điểm đến ${code} có thể hợp với một chuyến đi ngắn ngày nếu bạn ưu tiên lịch trình gọn.`
    };
}

function extractJsonPayload(text = '') {
    if (!text || typeof text !== 'string') return null;

    const fencedMatch =
        text.match(/```json\s*([\s\S]*?)```/i) ||
        text.match(/```\s*([\s\S]*?)```/i);
    const candidate = fencedMatch ? fencedMatch[1].trim() : text.trim();
    const firstObject = candidate.indexOf('{');
    const firstArray = candidate.indexOf('[');

    let startIndex = -1;
    if (firstObject >= 0 && firstArray >= 0) startIndex = Math.min(firstObject, firstArray);
    else if (firstObject >= 0) startIndex = firstObject;
    else if (firstArray >= 0) startIndex = firstArray;

    if (startIndex === -1) return null;

    const jsonCandidate = candidate.slice(startIndex);
    for (let endIndex = jsonCandidate.length; endIndex > 0; endIndex -= 1) {
        const snippet = jsonCandidate.slice(0, endIndex);
        try {
            return JSON.parse(snippet);
        } catch (error) {
            // Continue shrinking until a valid JSON block is found.
        }
    }

    return null;
}

async function callGeminiJson(prompt) {
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' } }
    );

    const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return extractJsonPayload(aiText);
}

function buildSearchErrorResponse(errorType, headline, message, tip) {
    return {
        success: false,
        errorType,
        headline,
        message,
        tip
    };
}

async function extractFlightInfo(userText) {
    const prompt = `
Ban la tro ly AI chuyen trich xuat thong tin chuyen bay tu cau van.
Hay phan tich cau sau va tra ve JSON voi cac truong:
- origin: ma san bay di (IATA, 3 ky tu)
- destination: ma san bay den
- date: ngay di theo dinh dang YYYY-MM-DD, neu khong co thi null
- budget: ngan sach toi da bang VND, neu khong co thi null

Chi tra ve JSON, khong giai thich them.

Cau van: "${userText}"
`;

    try {
        const parsed = await callGeminiJson(prompt);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            origin: sanitizeIata(parsed.origin, 'origin'),
            destination: sanitizeIata(parsed.destination, 'destination'),
            date: parsed.date || null,
            budget: parsed.budget || null
        };
    } catch (error) {
        console.error('Gemini error:', error.message);
        return null;
    }
}

function simpleParse(text) {
    const normalized = normalizeVietnamese(text);
    let origin = null;
    let destination = null;
    let date = null;
    let budget = null;

    const routePatterns = [
        /tu\s+(.+?)\s+den\s+(.+?)(?:\s+ngay|\s*,|\s+voi|\s+ngan sach|$)/i,
        /bay\s+tu\s+(.+?)\s+den\s+(.+?)(?:\s+ngay|\s*,|\s+voi|\s+ngan sach|$)/i
    ];

    for (const pattern of routePatterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        origin = resolveLocation(match[1], 'origin');
        destination = resolveLocation(match[2], 'destination');
        if (origin && destination) break;
    }

    if (!origin) {
        const broadOriginMatch = normalized.match(/tu\s+(viet nam|vietnam|vn)\b/i);
        if (broadOriginMatch) origin = 'HAN';
    }
    if (!destination) {
        const broadDestinationMatch = normalized.match(/den\s+(singapore|sing|thai lan|thailand|bangkok|viet nam|vietnam)\b/i);
        if (broadDestinationMatch) {
            destination = resolveLocation(broadDestinationMatch[1], 'destination');
        }
    }

    if (!origin || !destination) {
        const detected = [];
        for (const [code, aliases] of Object.entries(AIRPORT_ALIASES)) {
            if (aliases.some(alias => normalized.includes(alias))) {
                detected.push(code);
            }
        }
        if (normalized.includes('viet nam') || normalized.includes('vietnam')) {
            detected.push('HAN');
        }
        const unique = [...new Set(detected)];
        if (!origin && unique.length > 0) origin = unique[0];
        if (!destination && unique.length > 1) destination = unique[1];
    }

    const dateText = extractDateText(text);
    if (dateText) {
        let value = dateText;
        if (value.includes('/')) {
            const [day, month, year] = value.split('/');
            value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        date = value;
    }

    const millionStyleMatch = normalized.match(/(\d+)\s*m\s*(\d+)?/i);
    if (millionStyleMatch) {
        const wholeMillions = parseInt(millionStyleMatch[1], 10);
        const decimalPartRaw = millionStyleMatch[2] || '';
        const decimalPart = decimalPartRaw ? parseInt(decimalPartRaw, 10) / Math.pow(10, decimalPartRaw.length) : 0;
        budget = Math.round((wholeMillions + decimalPart) * 1000000);
    } else {
        const budgetMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(trieu|tr|ngan|k|vnd|d)/i);
        if (budgetMatch) {
            let amount = parseFloat(budgetMatch[1]);
            const unit = budgetMatch[2].toLowerCase();
            if (unit === 'trieu' || unit === 'tr') amount *= 1000000;
            else if (unit === 'ngan' || unit === 'k') amount *= 1000;
            budget = Math.round(amount);
        }
    }

    return {
        origin,
        destination,
        date: date || getSuggestedSearchDateString(),
        budget: budget || DEFAULT_BUDGET
    };
}

function sortFlights(a, b) {
    const left = a.price === null || a.price === undefined ? Number.MAX_SAFE_INTEGER : a.price;
    const right = b.price === null || b.price === undefined ? Number.MAX_SAFE_INTEGER : b.price;
    return left - right;
}

function formatLocalDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLocalDateTimeString(date) {
    return `${formatLocalDateString(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}

function parseDateString(dateString) {
    if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (
        Number.isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }
    return date;
}

function getTodayDateString() {
    return formatLocalDateString(new Date());
}

function addDaysToDateString(dateString, days) {
    const date = parseDateString(dateString);
    if (!date) return null;
    date.setDate(date.getDate() + days);
    return formatLocalDateString(date);
}

function buildDateTimeForSchedule(dateString, timeString = '00:00', addMinutes = 0) {
    const date = parseDateString(dateString);
    if (!date) return null;
    const [hours, minutes] = String(timeString).split(':').map(Number);
    date.setHours(hours || 0, (minutes || 0) + addMinutes, 0, 0);
    return formatLocalDateTimeString(date);
}

function formatDateForMessage(dateString) {
    const date = parseDateString(dateString);
    if (!date) return dateString;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getRealDataDatePolicy(dateString) {
    const today = getTodayDateString();
    const supportedFrom = addDaysToDateString(today, 8);

    if (dateString < today) {
        return {
            supported: false,
            reason: 'past_date',
            today,
            supportedFrom
        };
    }

    if (dateString < supportedFrom) {
        return {
            supported: false,
            reason: 'future_window_not_supported',
            today,
            supportedFrom
        };
    }

    return {
        supported: true,
        today,
        supportedFrom
    };
}

function pickNestedValue(record, keys = []) {
    if (!record || typeof record !== 'object') return null;
    for (const key of keys) {
        const value = record[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return null;
}

function normalizeOfficialFutureFlight(flight, from, to, date) {
    const airline = pickNestedValue(flight.airline, ['name']) || 'Hang bay';
    const bookingLink = getAirlineBookingLink(airline);

    return {
        airline,
        flightNumber: pickNestedValue(flight.flight, ['iataNumber', 'iata', 'number']) || 'N/A',
        flightDate: date,
        departure: pickNestedValue(flight.departure, ['scheduledTime', 'scheduled', 'estimatedTime']) || null,
        arrival: pickNestedValue(flight.arrival, ['scheduledTime', 'scheduled', 'estimatedTime']) || null,
        price: null,
        bookingLink,
        routeLink: getAirlineRouteLink(airline, from, to),
        routeLinkKeepsDate: false,
        airlineBookingLink: bookingLink,
        source: 'official-future',
        withinBudget: null,
        note: bookingLink
            ? `Tim thay lich bay that cho ngay ${date}. Gia can kiem tra truc tiep tren website cua hang.`
            : `Tim thay lich bay that cho ngay ${date}. App chua co link mo trang hang tu dong cho ${airline}, vui long tim theo ten hang va so hieu chuyen bay.`
    };
}

function buildDatePolicyMessage(label, dateString, policy) {
    if (policy.reason === 'past_date') {
        return `Tim chuyen bay dat ve cho ${label} chi ho tro tu ${formatDateForMessage(policy.today)} tro di. Ngay ${formatDateForMessage(dateString)} da qua.`;
    }

    return `Nguon du lieu lich bay that cho ${label} hien chi ho tro tim tu ${formatDateForMessage(policy.supportedFrom)} tro di. Vui long doi ngay bay hoac tim tren website hang.`;
}

function buildProviderFailureMessage(label, error) {
    const providerMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message;

    if (providerMessage) {
        return `Khong lay duoc du lieu lich bay that cho ${label}. Provider tra ve: ${providerMessage}`;
    }

    return `Khong lay duoc du lieu lich bay that cho ${label}. Vui long thu lai sau.`;
}

function isRateLimitedProviderError(error) {
    const providerMessage = String(
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        ''
    ).toLowerCase();

    return (
        error?.response?.status === 429 ||
        providerMessage.includes('rate limitation') ||
        providerMessage.includes('rate limit') ||
        providerMessage.includes('maximum rate limitation')
    );
}

function getDemoTemplatesForRoute(from, to) {
    const routeKey = `${from}-${to}`;
    if (!DEMO_ROUTE_DURATIONS[routeKey]) return [];

    if (from === 'SIN' || to === 'SIN') {
        return [
            { airline: 'Vietnam Airlines', prefix: 'VN', number: 661, departureTime: '08:45', price: 3890000 },
            { airline: 'Singapore Airlines', prefix: 'SQ', number: 191, departureTime: '11:55', price: 4290000 },
            { airline: 'Scoot', prefix: 'TR', number: 305, departureTime: '15:20', price: 2990000 },
            { airline: 'VietJet Air', prefix: 'VJ', number: 811, departureTime: '19:10', price: 3290000 }
        ];
    }

    if (from === 'BKK' || to === 'BKK') {
        return [
            { airline: 'Vietnam Airlines', prefix: 'VN', number: 615, departureTime: '07:40', price: 3490000 },
            { airline: 'Thai Airways', prefix: 'TG', number: 565, departureTime: '11:10', price: 4050000 },
            { airline: 'VietJet Air', prefix: 'VJ', number: 901, departureTime: '15:05', price: 2850000 },
            { airline: 'Bamboo Airways', prefix: 'QH', number: 329, departureTime: '19:35', price: 3150000 }
        ];
    }

    if (DOMESTIC_AIRPORT_CODES.includes(from) && DOMESTIC_AIRPORT_CODES.includes(to)) {
        return [
            { airline: 'Vietnam Airlines', prefix: 'VN', number: 211, departureTime: '06:20', price: 1990000 },
            { airline: 'VietJet Air', prefix: 'VJ', number: 187, departureTime: '09:35', price: 1490000 },
            { airline: 'Bamboo Airways', prefix: 'QH', number: 145, departureTime: '13:50', price: 1690000 },
            { airline: 'Vietnam Airlines', prefix: 'VN', number: 219, departureTime: '18:05', price: 2190000 }
        ];
    }

    return [];
}

function buildDemoFallbackFlights(from, to, date, budget) {
    const routeKey = `${from}-${to}`;
    const durationMinutes = DEMO_ROUTE_DURATIONS[routeKey];
    const templates = getDemoTemplatesForRoute(from, to);

    if (!durationMinutes || templates.length === 0) return [];

    return templates.map((template) => {
        const bookingLink = getAirlineBookingLink(template.airline);
        const price = template.price;
        return {
            airline: template.airline,
            flightNumber: `${template.prefix}${template.number}`,
            flightDate: date,
            departure: buildDateTimeForSchedule(date, template.departureTime),
            arrival: buildDateTimeForSchedule(date, template.departureTime, durationMinutes),
            price,
            bookingLink,
            routeLink: getAirlineRouteLink(template.airline, from, to),
            routeLinkKeepsDate: false,
            airlineBookingLink: bookingLink,
            source: 'demo-fallback',
            withinBudget: typeof budget === 'number' ? price <= budget : null,
            note: `Provider đang bị giới hạn request nên app tạm chuyển sang lịch bay demo cho ${from} -> ${to}. Đây là dữ liệu mô phỏng để bạn tiếp tục test giao diện và flow đặt vé, không phải lịch bay thật.`
        };
    }).sort(sortFlights);
}

function buildNoFlightMessage(label, from, to, date) {
    return `Khong tim thay lich bay that cho ${label}: ${from} -> ${to} ngay ${date}.`;
}

function getTravelMonthLabel(sections = []) {
    const labels = sections
        .map(section => parseDateString(section.date))
        .filter(Boolean)
        .map(date => `thang ${date.getMonth() + 1}`);

    return [...new Set(labels)].join(', ');
}

function buildBudgetLabel(budget) {
    return `${(budget || DEFAULT_BUDGET).toLocaleString('vi-VN')} VND`;
}

function buildConsultantFallback({ sections = [], budget }) {
    const seen = new Set();
    const destinations = sections
        .filter(section => section?.to)
        .map(section => section.to)
        .filter(code => {
            if (seen.has(code)) return false;
            seen.add(code);
            return true;
        })
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return {
                airportCode: meta.airportCode,
                city: meta.city,
                overview: meta.fallbackOverview,
                weatherTip: `Bạn nên kiểm tra dự báo trước ngày đi và ưu tiên quần áo dễ di chuyển ở ${meta.city}.`,
                packingTip: `Mang theo sạc dự phòng, giày dép dễ đi bộ và một túi nhỏ gọn gàng cho hành trình ${meta.city}.`,
                budgetIdeas: [
                    `Với ngân sách ${buildBudgetLabel(budget)}, ưu tiên các điểm tham quan miễn phí hoặc khu công cộng ở ${meta.city}.`,
                    'Đặt mức chi tiêu theo bữa ăn và di chuyển để giữ tổng ngân sách ổn định.',
                    'Nếu muốn tiết kiệm hơn, hãy ưu tiên phương tiện công cộng và khung giờ ít đông.'
                ],
                warning: `Đây là gợi ý fallback khi AI Travel Consultant tạm thời chưa trả về dữ liệu cho ${meta.city}.`
            };
        });

    return {
        title: 'AI Travel Consultant đang tải chậm một nhịp',
        intro: 'Mình tạm thời đưa một vài gợi ý an toàn để bạn vẫn có thể demo trọn vẹn luồng người dùng.',
        fallback: true,
        destinations
    };
}

function normalizeConsultantDestination(destination, fallbackCode) {
    const fallbackMeta = getAirportDisplayMeta(destination?.airportCode || fallbackCode);
    const budgetIdeas = Array.isArray(destination?.budgetIdeas)
        ? destination.budgetIdeas.filter(Boolean).slice(0, 3)
        : [];

    return {
        airportCode: destination?.airportCode || fallbackMeta.airportCode,
        city: destination?.city || fallbackMeta.city,
        overview: destination?.overview || fallbackMeta.fallbackOverview,
        weatherTip: destination?.weatherTip || `Hãy xem dự báo thời tiết gần ngày đi ở ${fallbackMeta.city}.`,
        packingTip: destination?.packingTip || `Mang theo đồ gọn nhẹ và hợp với lịch trình tại ${fallbackMeta.city}.`,
        budgetIdeas: budgetIdeas.length > 0
            ? budgetIdeas
            : [`Nếu cần tiết kiệm tại ${fallbackMeta.city}, hãy ưu tiên điểm tham quan miễn phí và phương tiện công cộng.`],
        warning: destination?.warning || `Bạn nên kiểm tra giờ mở cửa của điểm tham quan và thời tiết ở ${fallbackMeta.city} trước khi đi.`
    };
}

async function buildTravelConsultant({ tripType = 'oneway', budget = DEFAULT_BUDGET, sections = [] }) {
    const destinationCodes = [...new Set(
        sections
            .map(section => section?.to)
            .filter(Boolean)
    )];

    if (destinationCodes.length === 0) {
        return buildConsultantFallback({ sections, budget });
    }

    const destinationLines = destinationCodes
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return `- ${meta.airportCode}: ${meta.city}, ${meta.country}`;
        })
        .join('\n');

    const prompt = `
Bạn là AI Travel Consultant cho ứng dụng demo đặt vé máy bay.
Hãy trả về JSON DUY NHẤT theo đúng schema sau:
{
  "title": "string",
  "intro": "string",
  "destinations": [
    {
      "airportCode": "string",
      "city": "string",
      "overview": "string",
      "weatherTip": "string",
      "packingTip": "string",
      "budgetIdeas": ["string", "string", "string"],
      "warning": "string"
    }
  ]
}

Quy tắc:
- Viết tiếng Việt có dấu, thân thiện, ngắn gọn, hữu ích.
- budgetIdeas gồm tối đa 3 ý, ưu tiên hoạt động miễn phí hoặc chi phí vừa phải.
- warning là 1 câu ngắn để nhắc người dùng.
- Không giải thích thêm ngoài JSON.

Thông tin hành trình:
- Kiểu hành trình: ${tripType}
- Ngân sách: ${buildBudgetLabel(budget)}
- Thời điểm du lịch: ${getTravelMonthLabel(sections) || 'chưa rõ'}
- Điểm đến:
${destinationLines}
`;

    try {
        const parsed = await callGeminiJson(prompt);
        if (!parsed || !Array.isArray(parsed.destinations)) {
            return buildConsultantFallback({ sections, budget });
        }

        const normalizedDestinations = destinationCodes.map(code => {
            const matched = parsed.destinations.find(destination => {
                const airportCode = (destination?.airportCode || '').toUpperCase();
                const city = normalizeVietnamese(destination?.city || '');
                const meta = getAirportDisplayMeta(code);
                return airportCode === code || city.includes(normalizeVietnamese(meta.city));
            });
            return normalizeConsultantDestination(matched, code);
        });

        return {
            title: parsed.title || 'AI Travel Consultant',
            intro: parsed.intro || 'Mình gom sẵn một vài gợi ý nhanh để bạn có thể demo hành trình trọn vẹn hơn.',
            fallback: false,
            destinations: normalizedDestinations
        };
    } catch (error) {
        console.error('Gemini consultant error:', error.message);
        return buildConsultantFallback({ sections, budget });
    }
}

function buildConsultantFallback({ sections = [], budget }) {
    const seen = new Set();
    const destinations = sections
        .filter(section => section?.to)
        .map(section => section.to)
        .filter(code => {
            if (seen.has(code)) return false;
            seen.add(code);
            return true;
        })
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return {
                airportCode: meta.airportCode,
                city: meta.city,
                overview: meta.fallbackOverview,
                weatherTip: `Bạn nên kiểm tra dự báo trước ngày đi và ưu tiên quần áo dễ di chuyển ở ${meta.city}.`,
                packingTip: `Mang theo sạc dự phòng, giày dép dễ đi bộ và một túi nhỏ gọn gàng cho hành trình ${meta.city}.`,
                budgetIdeas: [
                    `Với ngân sách ${buildBudgetLabel(budget)}, ưu tiên các điểm tham quan miễn phí hoặc khu công cộng ở ${meta.city}.`,
                    'Đặt mức chi tiêu theo bữa ăn và di chuyển để giữ tổng ngân sách ổn định.',
                    'Nếu muốn tiết kiệm hơn, hãy ưu tiên phương tiện công cộng và khung giờ ít đông.'
                ],
                warning: `Đây là gợi ý fallback khi AI Travel Consultant tạm thời chưa trả về dữ liệu cho ${meta.city}.`
            };
        });

    return {
        title: 'AI Travel Consultant đang tải chậm một nhịp',
        intro: 'Mình tạm thời đưa một vài gợi ý an toàn để bạn vẫn có thể demo trọn vẹn luồng người dùng.',
        fallback: true,
        destinations
    };
}

function normalizeConsultantDestination(destination, fallbackCode) {
    const fallbackMeta = getAirportDisplayMeta(destination?.airportCode || fallbackCode);
    const budgetIdeas = Array.isArray(destination?.budgetIdeas)
        ? destination.budgetIdeas.filter(Boolean).slice(0, 3)
        : [];

    return {
        airportCode: destination?.airportCode || fallbackMeta.airportCode,
        city: destination?.city || fallbackMeta.city,
        overview: destination?.overview || fallbackMeta.fallbackOverview,
        weatherTip: destination?.weatherTip || `Hãy xem dự báo thời tiết gần ngày đi ở ${fallbackMeta.city}.`,
        packingTip: destination?.packingTip || `Mang theo đồ gọn nhẹ và hợp với lịch trình tại ${fallbackMeta.city}.`,
        budgetIdeas: budgetIdeas.length > 0
            ? budgetIdeas
            : [`Nếu cần tiết kiệm tại ${fallbackMeta.city}, hãy ưu tiên điểm tham quan miễn phí và phương tiện công cộng.`],
        warning: destination?.warning || `Bạn nên kiểm tra giờ mở cửa của điểm tham quan và thời tiết ở ${fallbackMeta.city} trước khi đi.`
    };
}

async function buildTravelConsultant({ tripType = 'oneway', budget = DEFAULT_BUDGET, sections = [] }) {
    const destinationCodes = [...new Set(
        sections
            .map(section => section?.to)
            .filter(Boolean)
    )];

    if (destinationCodes.length === 0) {
        return buildConsultantFallback({ sections, budget });
    }

    const destinationLines = destinationCodes
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return `- ${meta.airportCode}: ${meta.city}, ${meta.country}`;
        })
        .join('\n');

    const prompt = `
Bạn là AI Travel Consultant cho ứng dụng demo đặt vé máy bay.
Hãy trả về JSON DUY NHẤT theo đúng schema sau:
{
  "title": "string",
  "intro": "string",
  "destinations": [
    {
      "airportCode": "string",
      "city": "string",
      "overview": "string",
      "weatherTip": "string",
      "packingTip": "string",
      "budgetIdeas": ["string", "string", "string"],
      "warning": "string"
    }
  ]
}

Quy tắc:
- Viết tiếng Việt có dấu, thân thiện, ngắn gọn, hữu ích.
- budgetIdeas gồm tối đa 3 ý, ưu tiên hoạt động miễn phí hoặc chi phí vừa phải.
- warning là 1 câu ngắn để nhắc người dùng.
- Không giải thích thêm ngoài JSON.

Thông tin hành trình:
- Kiểu hành trình: ${tripType}
- Ngân sách: ${buildBudgetLabel(budget)}
- Thời điểm du lịch: ${getTravelMonthLabel(sections) || 'chưa rõ'}
- Điểm đến:
${destinationLines}
`;

    try {
        const parsed = await callGeminiJson(prompt);
        if (!parsed || !Array.isArray(parsed.destinations)) {
            return buildConsultantFallback({ sections, budget });
        }

        const normalizedDestinations = destinationCodes.map(code => {
            const matched = parsed.destinations.find(destination => {
                const airportCode = (destination?.airportCode || '').toUpperCase();
                const city = normalizeVietnamese(destination?.city || '');
                const meta = getAirportDisplayMeta(code);
                return airportCode === code || city.includes(normalizeVietnamese(meta.city));
            });
            return normalizeConsultantDestination(matched, code);
        });

        return {
            title: parsed.title || 'AI Travel Consultant',
            intro: parsed.intro || 'Mình gom sẵn một vài gợi ý nhanh để bạn có thể demo hành trình trọn vẹn hơn.',
            fallback: false,
            destinations: normalizedDestinations
        };
    } catch (error) {
        console.error('Gemini consultant error:', error.message);
        return buildConsultantFallback({ sections, budget });
    }
}

async function buildOfficialFlights(from, to, date) {
    const response = await axios.get('https://api.aviationstack.com/v1/flightsFuture', {
        params: {
            access_key: AVIATION_KEY,
            iataCode: from,
            type: 'departure',
            date
        }
    });

    if (response.data?.error) {
        const providerError = new Error(response.data.error.message || 'Aviationstack error');
        providerError.response = { data: response.data };
        throw providerError;
    }

    return (response.data?.data || [])
        .filter(flight => {
            const arrivalIata = pickNestedValue(flight.arrival, ['iataCode', 'iata', 'iata_code']);
            return arrivalIata === to;
        })
        .map(flight => normalizeOfficialFutureFlight(flight, from, to, date))
        .filter(Boolean)
        .sort(sortFlights);
}

async function searchLeg({ from, to, date, budget, label }) {
    if (!from || !to || !date) {
        return buildSearchErrorResponse(
            'input_missing',
            'May bay dang cho ban dien them mot chut',
            `Thieu thong tin cho ${label}.`,
            'Ban hay kiem tra lai diem di, diem den va ngay bay truoc khi tim.'
        );
    }

    if (from === to) {
        return buildSearchErrorResponse(
            'same_airport',
            'Hai dau san bay dang trung nhau roi',
            `Diem di va diem den cua ${label} khong the giong nhau.`,
            'Thu doi sang mot diem den khac de app co the tim chang bay hop ly hon.'
        );
    }

    const normalizedDate = getDateString(date);
    if (!normalizedDate) {
        return buildSearchErrorResponse(
            'invalid_date',
            'Ngay bay nay dang lam radar roi chut',
            `Ngay bay cua ${label} khong hop le.`,
            'Ban thu chon lai ngay theo dinh dang hop le de app tiep tuc tim kiem.'
        );
    }

    const datePolicy = getRealDataDatePolicy(normalizedDate);
    if (!datePolicy.supported) {
        return buildSearchErrorResponse(
            datePolicy.reason,
            datePolicy.reason === 'past_date'
                ? 'Ngay nay da cat canh tu lau roi'
                : 'Nguon lich bay that hen ban mot ngay khac',
            buildDatePolicyMessage(label, normalizedDate, datePolicy),
            datePolicy.reason === 'past_date'
                ? 'Ban hay doi sang ngay hien tai hoac mot ngay tuong lai de tiep tuc demo.'
                : `Ban thu chon ngay tu ${formatDateForMessage(datePolicy.supportedFrom)} tro di de xem lich bay that.`
        );
    }

    try {
        const officialFlights = await buildOfficialFlights(from, to, normalizedDate);
        if (officialFlights.length > 0) {
            return {
                success: true,
                section: {
                    title: label,
                    from,
                    to,
                    date: normalizedDate,
                    flights: officialFlights,
                    exact: false,
                    budgetMatches: null,
                    dataSource: 'official-future'
                }
            };
        }
        return buildSearchErrorResponse(
            'no_flights',
            'Chuyen nay dang tron ve du lieu roi',
            buildNoFlightMessage(label, from, to, normalizedDate),
            'Ban co the thu doi ngay, doi chang bay hoac tiep tuc mo website hang o buoc sau de doi chieu them.'
        );
    } catch (error) {
        console.error('API error:', error.message);
        if (isRateLimitedProviderError(error)) {
            const demoFlights = buildDemoFallbackFlights(from, to, normalizedDate, budget);
            if (demoFlights.length > 0) {
                return {
                    success: true,
                    section: {
                        title: label,
                        from,
                        to,
                        date: normalizedDate,
                        flights: demoFlights,
                        exact: false,
                        budgetMatches: demoFlights.filter(flight => flight.withinBudget === true).length,
                        dataSource: 'demo-fallback'
                    }
                };
            }

            return buildSearchErrorResponse(
                'provider_rate_limited',
                'Provider dang tam khoa nhip truy van',
                buildProviderFailureMessage(label, error),
                'Goi free cua provider da het quota hoac vuot rate limit. Ban thu doi it phut, doi key, hoac demo bang chang pho bien hon de app dung fallback neu co.'
            );
        }

        return buildSearchErrorResponse(
            'provider_failure',
            'Provider dang hoi met mot chut',
            buildProviderFailureMessage(label, error),
            'Ban thu lai sau it phut, hoac doi ngay bay khac de test demo tiep.'
        );
    }
}

async function buildTripSections({ tripType, from, to, date, returnDate, budget, legs }) {
    if (tripType === 'roundtrip') {
        const outbound = await searchLeg({ from, to, date, budget, label: 'Luot di' });
        if (!outbound.success) return outbound;

        const inbound = await searchLeg({ from: to, to: from, date: returnDate, budget, label: 'Luot ve' });
        if (!inbound.success) return inbound;

        return {
            success: true,
            sections: [outbound.section, inbound.section]
        };
    }

    if (tripType === 'multicity') {
        if (!Array.isArray(legs) || legs.length < 2) {
            return buildSearchErrorResponse(
                'multicity_too_short',
                'Mot chuyen multi-city ma moi co mot chang thi hoi buon',
                'Nhieu chang can it nhat 2 chang bay.',
                'Ban them it nhat mot chang nua de luong nhieu chang hien ra day du.'
            );
        }

        const sections = [];
        for (let index = 0; index < legs.length; index += 1) {
            const leg = legs[index];
            const result = await searchLeg({
                from: leg.from,
                to: leg.to,
                date: leg.date,
                budget,
                label: `Chang ${index + 1}`
            });
            if (!result.success) return result;
            sections.push(result.section);
        }

        return { success: true, sections };
    }

    const oneWay = await searchLeg({ from, to, date, budget, label: 'Mot chieu' });
    if (!oneWay.success) return oneWay;
    return { success: true, sections: [oneWay.section] };
}

function buildConsultantFallback({ sections = [], budget }) {
    const seen = new Set();
    const destinations = sections
        .filter(section => section?.to)
        .map(section => section.to)
        .filter(code => {
            if (seen.has(code)) return false;
            seen.add(code);
            return true;
        })
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return {
                airportCode: meta.airportCode,
                city: meta.city,
                overview: meta.fallbackOverview,
                weatherTip: `Bạn nên kiểm tra dự báo trước ngày đi và ưu tiên quần áo dễ di chuyển ở ${meta.city}.`,
                packingTip: `Mang theo sạc dự phòng, giày dép dễ đi bộ và một túi nhỏ gọn gàng cho hành trình ${meta.city}.`,
                budgetIdeas: [
                    `Với ngân sách ${buildBudgetLabel(budget)}, ưu tiên các điểm tham quan miễn phí hoặc khu công cộng ở ${meta.city}.`,
                    'Đặt mức chi tiêu theo bữa ăn và di chuyển để giữ tổng ngân sách ổn định.',
                    'Nếu muốn tiết kiệm hơn, hãy ưu tiên phương tiện công cộng và khung giờ ít đông.'
                ],
                warning: `Đây là gợi ý fallback khi AI Travel Consultant tạm thời chưa trả về dữ liệu cho ${meta.city}.`
            };
        });

    return {
        title: 'AI Travel Consultant đang tải chậm một nhịp',
        intro: 'Mình tạm thời đưa một vài gợi ý an toàn để bạn vẫn có thể demo trọn vẹn luồng người dùng.',
        fallback: true,
        destinations
    };
}

function normalizeConsultantDestination(destination, fallbackCode) {
    const fallbackMeta = getAirportDisplayMeta(destination?.airportCode || fallbackCode);
    const budgetIdeas = Array.isArray(destination?.budgetIdeas)
        ? destination.budgetIdeas.filter(Boolean).slice(0, 3)
        : [];

    return {
        airportCode: destination?.airportCode || fallbackMeta.airportCode,
        city: destination?.city || fallbackMeta.city,
        overview: destination?.overview || fallbackMeta.fallbackOverview,
        weatherTip: destination?.weatherTip || `Hãy xem dự báo thời tiết gần ngày đi ở ${fallbackMeta.city}.`,
        packingTip: destination?.packingTip || `Mang theo đồ gọn nhẹ và hợp với lịch trình tại ${fallbackMeta.city}.`,
        budgetIdeas: budgetIdeas.length > 0
            ? budgetIdeas
            : [`Nếu cần tiết kiệm tại ${fallbackMeta.city}, hãy ưu tiên điểm tham quan miễn phí và phương tiện công cộng.`],
        warning: destination?.warning || `Bạn nên kiểm tra giờ mở cửa của điểm tham quan và thời tiết ở ${fallbackMeta.city} trước khi đi.`
    };
}

async function buildTravelConsultant({ tripType = 'oneway', budget = DEFAULT_BUDGET, sections = [] }) {
    const destinationCodes = [...new Set(
        sections
            .map(section => section?.to)
            .filter(Boolean)
    )];

    if (destinationCodes.length === 0) {
        return buildConsultantFallback({ sections, budget });
    }

    const destinationLines = destinationCodes
        .map(code => {
            const meta = getAirportDisplayMeta(code);
            return `- ${meta.airportCode}: ${meta.city}, ${meta.country}`;
        })
        .join('\n');

    const prompt = `
Bạn là AI Travel Consultant cho ứng dụng demo đặt vé máy bay.
Hãy trả về JSON DUY NHẤT theo đúng schema sau:
{
  "title": "string",
  "intro": "string",
  "destinations": [
    {
      "airportCode": "string",
      "city": "string",
      "overview": "string",
      "weatherTip": "string",
      "packingTip": "string",
      "budgetIdeas": ["string", "string", "string"],
      "warning": "string"
    }
  ]
}

Quy tắc:
- Viết tiếng Việt có dấu, thân thiện, ngắn gọn, hữu ích.
- budgetIdeas gồm tối đa 3 ý, ưu tiên hoạt động miễn phí hoặc chi phí vừa phải.
- warning là một câu ngắn để nhắc người dùng.
- Không giải thích thêm ngoài JSON.

Thông tin hành trình:
- Kiểu hành trình: ${tripType}
- Ngân sách: ${buildBudgetLabel(budget)}
- Thời điểm du lịch: ${getTravelMonthLabel(sections) || 'chưa rõ'}
- Điểm đến:
${destinationLines}
`;

    try {
        const parsed = await callGeminiJson(prompt);
        if (!parsed || !Array.isArray(parsed.destinations)) {
            return buildConsultantFallback({ sections, budget });
        }

        const normalizedDestinations = destinationCodes.map(code => {
            const matched = parsed.destinations.find(destination => {
                const airportCode = (destination?.airportCode || '').toUpperCase();
                const city = normalizeVietnamese(destination?.city || '');
                const meta = getAirportDisplayMeta(code);
                return airportCode === code || city.includes(normalizeVietnamese(meta.city));
            });
            return normalizeConsultantDestination(matched, code);
        });

        return {
            title: parsed.title || 'AI Travel Consultant',
            intro: parsed.intro || 'Mình gom sẵn một vài gợi ý nhanh để bạn có thể demo hành trình trọn vẹn hơn.',
            fallback: false,
            destinations: normalizedDestinations
        };
    } catch (error) {
        console.error('Gemini consultant error:', error.message);
        return buildConsultantFallback({ sections, budget });
    }
}

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'ok',
        port: PORT,
        time: new Date().toISOString()
    });
});

app.post('/api/search', async (req, res) => {
    try {
        let {
            from,
            to,
            date,
            returnDate,
            budget,
            text,
            tripType = 'oneway',
            legs = []
        } = req.body || {};

        if (!budget) budget = DEFAULT_BUDGET;
        console.log('Request:', buildRequestLog({ from, to, date, returnDate, budget, text, tripType, legs }));

        if (text) {
            const aiInfo = await extractFlightInfo(text);
            const parsed = aiInfo && aiInfo.origin && aiInfo.destination ? aiInfo : simpleParse(text);
            const airportClarification = buildVietnamAirportClarification(text, parsed);
            if (airportClarification) {
                return res.json({
                    success: false,
                    needsClarification: true,
                    message: airportClarification.message,
                    suggestionPrompts: airportClarification.suggestionPrompts
                });
            }
            const clarity = analyzeTextClarity(text, parsed);
            if (clarity.needsMoreDetails) {
                return res.json({
                    success: false,
                    needsClarification: true,
                    message: buildAmbiguousPromptMessage(),
                    suggestionPrompts: buildDefaultClarificationPrompts()
                });
            }
            from = parsed.origin;
            to = parsed.destination;
            date = parsed.date;
            budget = parsed.budget;
            tripType = 'oneway';
        }

        const trip = await buildTripSections({ tripType, from, to, date, returnDate, budget, legs });
        if (!trip.success) {
            return res.json(trip);
        }

        return res.json({
            success: true,
            tripType,
            budget,
            sections: trip.sections,
            summary: {
                totalSections: trip.sections.length,
                totalFlights: trip.sections.reduce((sum, section) => sum + section.flights.length, 0)
            }
        });
    } catch (error) {
        console.error('Unexpected /api/search error:', error);
        return res.status(500).json(buildSearchErrorResponse(
            'server_failure',
            'Backend vua gap mot nhieu dong bat ngo',
            `Khong xu ly duoc yeu cau tim chuyen bay. Chi tiet: ${error?.message || 'unknown error'}`,
            'Ban thu xem lai terminal server.js de doc dong loi cu the, sau do refresh trang va tim lai.'
        ));
    }
});

app.post('/api/consultant', async (req, res) => {
    try {
        const {
            tripType = 'oneway',
            budget = DEFAULT_BUDGET,
            sections = []
        } = req.body || {};

        if (!Array.isArray(sections) || sections.length === 0) {
            return res.json(buildSearchErrorResponse(
                'consultant_missing_sections',
                'AI consultant dang can mot hanh trinh de doc vi',
                'Chua co du lieu hanh trinh de tu van.',
                'Hay tim chuyen bay truoc, roi app se goi y diem den cho ban ngay sau do.'
            ));
        }

        const consultant = await buildTravelConsultant({ tripType, budget, sections });
        return res.json({
            success: true,
            consultant
        });
    } catch (error) {
        console.error('Unexpected /api/consultant error:', error);
        return res.status(500).json(buildSearchErrorResponse(
            'consultant_failure',
            'AI consultant vua can them mot nhip nghi',
            `Khong tao duoc goi y du lich luc nay. Chi tiet: ${error?.message || 'unknown error'}`,
            'Ket qua chuyen bay van dung duoc. Ban co the tim tiep hoac mo lai trang de thu lai consultant.'
        ));
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'WEB.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server chay tai http://0.0.0.0:${PORT}`);
});
