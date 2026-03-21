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

const LOCAL_FLIGHTS = {
    'HAN-SIN': [
        { flightNumber: 'VN661', airline: 'Vietnam Airlines', departure: '09:30', arrival: '12:45', price: 3850000 },
        { flightNumber: 'SQ177', airline: 'Singapore Airlines', departure: '15:20', arrival: '18:35', price: 4750000 },
        { flightNumber: 'TR303', airline: 'Scoot', departure: '18:00', arrival: '20:30', price: 2450000 }
    ],
    'SGN-SIN': [
        { flightNumber: 'VN651', airline: 'Vietnam Airlines', departure: '07:40', arrival: '10:10', price: 3650000 },
        { flightNumber: 'SQ185', airline: 'Singapore Airlines', departure: '12:50', arrival: '15:20', price: 4550000 },
        { flightNumber: 'TR303', airline: 'Scoot', departure: '18:00', arrival: '20:30', price: 2450000 }
    ],
    'HAN-BKK': [
        { flightNumber: 'VN615', airline: 'Vietnam Airlines', departure: '09:00', arrival: '11:30', price: 2890000 },
        { flightNumber: 'VJ903', airline: 'VietJet Air', departure: '14:20', arrival: '16:50', price: 2150000 },
        { flightNumber: 'TG561', airline: 'Thai Airways', departure: '19:45', arrival: '22:15', price: 3450000 }
    ],
    'SGN-BKK': [
        { flightNumber: 'VN601', airline: 'Vietnam Airlines', departure: '07:30', arrival: '09:00', price: 2690000 },
        { flightNumber: 'VJ801', airline: 'VietJet Air', departure: '12:15', arrival: '13:45', price: 1950000 },
        { flightNumber: 'TG551', airline: 'Thai Airways', departure: '16:40', arrival: '18:10', price: 3250000 }
    ],
    'HAN-SGN': [
        { flightNumber: 'VN213', airline: 'Vietnam Airlines', departure: '08:00', arrival: '10:15', price: 1890000 },
        { flightNumber: 'VJ125', airline: 'VietJet Air', departure: '09:30', arrival: '11:45', price: 1250000 },
        { flightNumber: 'QH271', airline: 'Bamboo Airways', departure: '14:20', arrival: '16:35', price: 1650000 }
    ],
    'SGN-HAN': [
        { flightNumber: 'VN254', airline: 'Vietnam Airlines', departure: '11:00', arrival: '13:15', price: 1890000 },
        { flightNumber: 'VJ130', airline: 'VietJet Air', departure: '18:20', arrival: '20:35', price: 1350000 },
        { flightNumber: 'QH204', airline: 'Bamboo Airways', departure: '07:10', arrival: '09:20', price: 1650000 }
    ]
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

function buildAmbiguousPromptMessage() {
    return 'Yeu cau cua ban con mo ho. Vui long cung cap them san bay hoac noi ban o gan nhat, ngay gio bay va ngan sach. Neu khong ghi ngan sach, he thong se mac dinh 3.000.000 VND. Vi du: "Toi muon bay tu Ha Noi den Singapore ngay 21/03/2026, ngan sach 4 trieu".';
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
    const dateText = extractDateText(text) || '21/03/2026';
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
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return null;
    return input;
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
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const parsed = JSON.parse(jsonMatch[0]);
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
        date: date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        budget: budget || DEFAULT_BUDGET
    };
}

function sortFlights(a, b) {
    const left = a.price === null || a.price === undefined ? Number.MAX_SAFE_INTEGER : a.price;
    const right = b.price === null || b.price === undefined ? Number.MAX_SAFE_INTEGER : b.price;
    return left - right;
}

function buildBudgetNote(price, budget) {
    if (price === null || price === undefined || !budget) return '';
    if (price <= budget) {
        return `Gia nam trong ngan sach ${budget.toLocaleString()} VND.`;
    }
    return `Gia vuot ngan sach ${budget.toLocaleString()} VND ${(
        price - budget
    ).toLocaleString()} VND.`;
}

function buildLocalFlights(from, to, date, budget) {
    const key = `${from}-${to}`;
    const flights = LOCAL_FLIGHTS[key] || [];
    return flights.map(flight => {
        const bookingLink = getAirlineBookingLink(flight.airline);
        const routeLink = getAirlineRouteLink(flight.airline, from, to);
        return {
            airline: flight.airline,
            flightNumber: flight.flightNumber,
            flightDate: date,
            departure: flight.departure,
            arrival: flight.arrival,
            price: flight.price,
            bookingLink,
            routeLink,
            routeLinkKeepsDate: false,
            airlineBookingLink: bookingLink,
            source: 'local',
            withinBudget: flight.price <= budget,
            note: `${buildBudgetNote(flight.price, budget)} ${routeLink ? 'Nut tim lai se mo page dung chang bay tren website hang, nhung ngay co the bi reset theo du lieu mac dinh cua hang.' : 'Hang hien khong co route-page on dinh, app se mo trang flight tickets chinh thuc.'}`.trim()
        };
    }).sort(sortFlights);
}

async function buildOfficialFlights(from, to, date) {
    const response = await axios.get('http://api.aviationstack.com/v1/flights', {
        params: {
            access_key: AVIATION_KEY,
            dep_iata: from,
            arr_iata: to,
            limit: 20
        }
    });

    return (response.data?.data || [])
        .filter(flight => flight.flight_date === date)
        .map(flight => {
            const airline = flight.airline?.name || 'Hang bay';
            const bookingLink = getAirlineBookingLink(airline);
            const routeLink = getAirlineRouteLink(airline, from, to);
            if (!bookingLink) return null;
            return {
                airline,
                flightNumber: flight.flight?.iata || flight.flight?.number || 'N/A',
                flightDate: flight.flight_date,
                departure: flight.departure?.scheduled || null,
                arrival: flight.arrival?.scheduled || null,
                price: null,
                bookingLink,
                routeLink,
                routeLinkKeepsDate: false,
                airlineBookingLink: bookingLink,
                source: 'official-schedule',
                withinBudget: null,
                note: routeLink
                    ? `Tim thay lich bay dung ngay ${flight.flight_date}. Nut tim lai se mo page theo chang ${from} -> ${to} tren website hang, nhung ngay tren website co the khac do hang khong giu deep-link ngay cong khai.`
                    : `Tim thay lich bay dung ngay ${flight.flight_date}. Hang nay khong co route-page cong khai on dinh nen app se mo trang flight tickets cua hang.`
            };
        })
        .filter(Boolean)
        .sort(sortFlights);
}

async function searchLeg({ from, to, date, budget, label }) {
    if (!from || !to || !date) {
        return {
            success: false,
            message: `Thieu thong tin cho ${label}.`
        };
    }

    if (from === to) {
        return {
            success: false,
            message: `Diem di va diem den cua ${label} khong the giong nhau.`
        };
    }

    const normalizedDate = getDateString(date);
    if (!normalizedDate) {
        return {
            success: false,
            message: `Ngay bay cua ${label} khong hop le.`
        };
    }

    const localFlights = buildLocalFlights(from, to, normalizedDate, budget);
    if (localFlights.length > 0) {
        return {
            success: true,
            section: {
                title: label,
                from,
                to,
                date: normalizedDate,
                flights: localFlights,
                exact: true,
                budgetMatches: localFlights.filter(flight => flight.withinBudget).length
            }
        };
    }

    try {
        const officialFlights = await buildOfficialFlights(from, to, normalizedDate);
        if (officialFlights.length === 0) {
            return {
                success: false,
                message: `Chua co du lieu chinh xac cho ${label}: ${from} -> ${to} ngay ${normalizedDate}.`
            };
        }

        return {
            success: true,
            section: {
                title: label,
                from,
                to,
                date: normalizedDate,
                flights: officialFlights,
                exact: false,
                budgetMatches: null
            }
        };
    } catch (error) {
        console.error('API error:', error.message);
        return {
            success: false,
            message: `Khong lay duoc du lieu cho ${label}.`
        };
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
            return {
                success: false,
                message: 'Nhieu chang can it nhat 2 chang bay.'
            };
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

app.post('/api/search', async (req, res) => {
    let {
        from,
        to,
        date,
        returnDate,
        budget,
        text,
        tripType = 'oneway',
        legs = []
    } = req.body;

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
                suggestionPrompts: [
                    'Toi muon bay tu Ha Noi den Singapore ngay 21/03/2026, ngan sach 4 trieu',
                    'Toi muon bay tu TP. Ho Chi Minh den Bangkok ngay 25/03/2026, ngan sach 3 trieu',
                    'Toi muon bay tu Da Nang den Ha Noi ngay 22/03/2026, ngan sach 2 trieu'
                ]
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
        return res.json({
            success: false,
            message: trip.message
        });
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
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'WEB.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server chay tai http://0.0.0.0:${PORT}`);
});
