import React, { useMemo } from 'react';
import FlightAssistant from './FlightAssistant';

function toYyMmDd(input) {
  if (!input) return '';
  const normalized = String(input).trim();

  // Accept: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY
  const yyyyFirst = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (yyyyFirst) {
    const [, yyyy, mm, dd] = yyyyFirst;
    return `${yyyy.slice(-2)}${mm}${dd}`;
  }

  const ddFirst = normalized.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddFirst) {
    const [, dd, mm, yyyy] = ddFirst;
    return `${yyyy.slice(-2)}${mm}${dd}`;
  }

  // Already compact date (yymmdd)
  if (/^\d{6}$/.test(normalized)) return normalized;
  return '';
}

function toIsoDate(input) {
  if (!input) return '';
  const normalized = String(input).trim();
  const yyyyFirst = normalized.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (yyyyFirst) {
    const [, yyyy, mm, dd] = yyyyFirst;
    return `${yyyy}-${mm}-${dd}`;
  }
  const ddFirst = normalized.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (ddFirst) {
    const [, dd, mm, yyyy] = ddFirst;
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

function buildSkyscannerUrl(origin, destination, dateInput) {
  const o = String(origin || '').toLowerCase();
  const d = String(destination || '').toLowerCase();
  const yymmdd = toYyMmDd(dateInput);
  if (!o || !d || !yymmdd) return '';
  return `https://www.skyscanner.com.vn/transport/flights/${o}/${d}/${yymmdd}`;
}

function buildVietjetUrl({ origin, destination, dateInput, flightNumber }) {
  const o = String(origin || '').toUpperCase();
  const d = String(destination || '').toUpperCase();
  const dateIso = toIsoDate(dateInput);
  const no = String(flightNumber || '').toUpperCase();

  // Best-effort dynamic link to booking page with prefilled params.
  if (o && d && dateIso) {
    const q = new URLSearchParams({
      origin: o,
      destination: d,
      departureDate: dateIso,
      flightNumber: no
    });
    return `https://www.vietjetair.com/vi/booking-flight?${q.toString()}`;
  }

  // Fallback: homepage + flight number hint.
  const fallbackQ = new URLSearchParams({ flightNo: no || '' });
  return `https://www.vietjetair.com/vi?${fallbackQ.toString()}`;
}

export default function FlightBookingPopup({
  isOpen,
  onClose,
  flight = {
    airline: 'VietJet Air',
    flightNumber: 'VJ801',
    origin: 'SGN',
    destination: 'BKK',
    date: '2026-06-26',
    departureTime: '09:15',
    arrivalTime: '10:45'
  }
}) {
  const skyscannerUrl = useMemo(
    () => buildSkyscannerUrl(flight.origin, flight.destination, flight.date),
    [flight.origin, flight.destination, flight.date]
  );

  const vietjetUrl = useMemo(
    () =>
      buildVietjetUrl({
        origin: flight.origin,
        destination: flight.destination,
        dateInput: flight.date,
        flightNumber: flight.flightNumber
      }),
    [flight.origin, flight.destination, flight.date, flight.flightNumber]
  );

  if (isOpen) {
    // Per user request, log flight data to inspect its structure.
    console.log('Flight data in popup:', flight);
  }

  if (!isOpen) return null;

  const formatDisplayTime = (time) => {
    if (!time) return '--';

    // Handle object from API or string from mock/default data
    const timeStr =
      typeof time === 'object' && time !== null
        ? time?.scheduledTime?.local || time?.scheduledTime?.utc
        : time;

    if (typeof timeStr !== 'string') {
      // If it's still not a string, it's an object we can't handle.
      return '[object Object]';
    }

    try {
      // Handle various ISO-like formats, including with a space separator
      const date = new Date(timeStr.replace(' ', 'T'));
      if (isNaN(date.getTime())) {
        return timeStr; // Return original string if it's not a valid date
      }

      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');

      return `${hours}:${minutes} ${day}-${month}`;
    } catch (e) {
      return timeStr; // Fallback to original string on error
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose} role="presentation">
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.headerRow}>
          <h3 style={styles.title}>Thông tin chuyến bay</h3>
          <button type="button" onClick={onClose} style={styles.closeBtn}>
            Đóng
          </button>
        </div>

        <div style={styles.summaryBox}>
          <div style={styles.summaryItem}>
            <span style={styles.label}>Chuyến bay</span>
            <strong>{flight.airline ? `${flight.airline} · ` : ''}{flight.flightNumber || 'N/A'}</strong>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.label}>Hành trình</span>
            <strong>
              {(flight.origin || '--').toUpperCase()} - {(flight.destination || '--').toUpperCase()}
            </strong>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.label}>Giờ đi - giờ đến</span>
            <strong>
              {formatDisplayTime(flight.departure || flight.departureTime)} - {formatDisplayTime(flight.arrival || flight.arrivalTime)}
            </strong>
          </div>
        </div>

        <div style={styles.actionRow}>
          <a href={skyscannerUrl || '#'} target="_blank" rel="noopener noreferrer" style={styles.primaryBtn}>
            Đặt vé ngay
          </a>
          <a href={vietjetUrl} target="_blank" rel="noopener noreferrer" style={styles.secondaryBtn}>
            Đặt vé trực tiếp tại hãng
          </a>
        </div>

        {/* --- Flight Assistant Component --- */}
        <FlightAssistant flight={flight} />
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11, 21, 39, 0.62)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9999
  },
  modal: {
    width: 'min(560px, 100%)',
    background: '#fff',
    borderRadius: 20,
    padding: 20,
    boxShadow: '0 20px 54px rgba(0,0,0,0.25)'
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  title: { margin: 0, color: '#13213b' },
  closeBtn: {
    border: '1px solid #d5deed',
    borderRadius: 10,
    background: '#fff',
    padding: '8px 12px',
    cursor: 'pointer',
    fontWeight: 600
  },
  summaryBox: {
    marginTop: 14,
    border: '1px solid #dce5f2',
    borderRadius: 14,
    padding: 14,
    display: 'grid',
    gap: 10
  },
  summaryItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  label: { color: '#5f6f89', fontSize: 14 },
  actionRow: {
    marginTop: 16,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontWeight: 700,
    borderRadius: 12,
    padding: '12px 14px',
    background: '#0f62fe',
    color: '#fff'
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    fontWeight: 700,
    borderRadius: 12,
    padding: '12px 14px',
    background: '#0f172a',
    color: '#fff'
  }
};

