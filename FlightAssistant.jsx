import React, { useState, useMemo } from 'react';

// --- Utility Functions ---

function calculateDuration(dep, arr) {
  if (!dep || !arr) return '--';
  // Attempt to parse datetime string or standard ISO
  const d1 = new Date(typeof dep === 'object' ? (dep.local || dep.utc) : String(dep).replace(' ', 'T'));
  const d2 = new Date(typeof arr === 'object' ? (arr.local || arr.utc) : String(arr).replace(' ', 'T'));

  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '--';
  const diffMs = d2.getTime() - d1.getTime();
  if (diffMs <= 0) return '--';

  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

function getCheckInTimes(dep) {
  if (!dep) return null;
  const d1 = new Date(typeof dep === 'object' ? (dep.local || dep.utc) : String(dep).replace(' ', 'T'));
  if (isNaN(d1.getTime())) return null;

  const onlineCheckin = new Date(d1.getTime() - 24 * 3600000);
  const airportArrival = new Date(d1.getTime() - 2 * 3600000);

  const formatTime = (ts) => {
    const hh = String(ts.getHours()).padStart(2, '0');
    const mm = String(ts.getMinutes()).padStart(2, '0');
    const DD = String(ts.getDate()).padStart(2, '0');
    const MM = String(ts.getMonth() + 1).padStart(2, '0');
    return `${hh}:${mm} (${DD}/${MM})`;
  };

  return {
    flightTime: formatTime(d1),
    online: formatTime(onlineCheckin),
    airport: formatTime(airportArrival)
  };
}

function getBaggageRules(airlineStr, flightNumberStr) {
  const al = String(airlineStr || '').toLowerCase();
  const num = String(flightNumberStr || '').toLowerCase();

  const isVN = al.includes('vietnam airlines') || num.startsWith('vn');
  const isQH = al.includes('bamboo') || num.startsWith('qh');

  if (isVN) {
    return {
      carryOn: '12kg Xách tay',
      detail: 'Tiêu chuẩn hạng phổ thông gồm 1 kiện 10kg và 1 phụ kiện 2kg.',
      checkinRef: 'Hành lý ký gửi: Thường từ 23kg (tùy theo hạng vé chi tiết).'
    };
  }
  if (isQH) {
    return {
      carryOn: '7kg Xách tay',
      detail: 'Kiện xách tay tối đa 7kg với kích thước chuẩn.',
      checkinRef: 'Hành lý ký gửi: Được tính theo từng hạng vé Eco/Plus/Business.'
    };
  }

  // Default for VietJet (VJ), Pacific (BL), Scoot (TR)...
  return {
    carryOn: '7kg Xách tay',
    detail: 'Chỉ bao gồm 1 kiện 7kg xách tay tiêu chuẩn.',
    checkinRef: 'Hành lý ký gửi: Thường phải mua thêm. Kiểm tra kỹ mặt vé của bạn!'
  };
}

// --- Icons (Inline SVG) ---

const Icons = {
  Flight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6.8 3.4L6.5 14.7 3.6 14l-1.6 1.6 4.3 2 2.1 4.2 1.6-1.5-.7-2.9 3.2-3.3 3.5 6.7c.4.6.8.8 1.4.6l.8-.8c.4-.2.4-.7.3-1.2z" />
    </svg>
  ),
  Clock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
    </svg>
  ),
  Luggage: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20h12" /><path d="M8 20V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12" /><path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" /><path d="M8 12h8" /><path d="M8 16h8" />
    </svg>
  ),
  Checklist: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11 3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  )
};

// --- Component ---

export default function FlightAssistant({ flight }) {
  const [checklist, setChecklist] = useState([
    { id: 'id_doc', label: 'Giấy tờ tùy thân (CCCD / Hộ chiếu)', checked: false },
    { id: 'ticket', label: 'Vé điện tử (E-ticket) / Boarding pass', checked: false },
    { id: 'power_bank', label: 'Sạc dự phòng (Bắt buộc xách tay, không ký gửi)', checked: false },
    { id: 'med', label: 'Thuốc men cá nhân thiết yếu', checked: false },
  ]);

  if (!flight) return null;

  const times = useMemo(() => getCheckInTimes(flight.departure || flight.departureTime), [flight]);
  const duration = useMemo(() => calculateDuration(flight.departure || flight.departureTime, flight.arrival || flight.arrivalTime), [flight]);
  const baggage = useMemo(() => getBaggageRules(flight.airline, flight.flightNumber), [flight]);

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const progress = Math.round((checklist.filter(i => i.checked).length / checklist.length) * 100);

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Flight Assistant</h2>
      <p style={styles.subtitle}>Chuẩn bị cho chuyến bay của bạn một cách tốt nhất.</p>

      <div style={styles.grid}>

        {/* Card 1: Tóm tắt hành trình */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.iconBox}><Icons.Flight /></div>
            <h3 style={styles.cardTitle}>Tóm tắt hành trình</h3>
          </div>
          <div style={styles.timeline}>
            <div style={styles.routeBox}>
              <span style={styles.airportCode}>{flight.origin || '---'}</span>
              <div style={styles.flightLine}>
                <span style={styles.durationBadge}>{duration}</span>
                <div style={styles.line}></div>
                <Icons.ArrowRight />
              </div>
              <span style={styles.airportCode}>{flight.destination || '---'}</span>
            </div>
            <div style={styles.flightMeta}>
              <strong>{flight.airline || 'Hãng bay'}</strong> · {flight.flightNumber || 'N/A'}
            </div>
          </div>
        </div>

        {/* Card 2: Nhắc giờ check-in */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#fef08a', color: '#854d0e' }}><Icons.Clock /></div>
            <h3 style={styles.cardTitle}>Nhắc giờ Check-in</h3>
          </div>
          {times ? (
            <div style={styles.timeList}>
              <div style={styles.timeRow}>
                <span style={styles.timeDot}></span>
                <div style={styles.timeContent}>
                  <span style={styles.timeLabel}>Mở Check-in Online</span>
                  <strong style={styles.timeValue}>{times.online}</strong>
                  <span style={styles.timeHint}>Sẵn sàng điện thoại/máy tính để chọn chỗ.</span>
                </div>
              </div>
              <div style={styles.timeRow}>
                <span style={{ ...styles.timeDot, background: '#ef4444' }}></span>
                <div style={styles.timeContent}>
                  <span style={styles.timeLabel}>Có mặt tại sân bay (Chậm nhất)</span>
                  <strong style={styles.timeValue}>{times.airport}</strong>
                  <span style={styles.timeHint}>Quầy làm thủ tục thường đóng trước 45-50 phút.</span>
                </div>
              </div>
            </div>
          ) : (
            <p style={styles.mutedText}>Không có dữ liệu giờ bay để tính toán.</p>
          )}
        </div>

        {/* Card 3: Quy định hành lý */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#dbeafe', color: '#1e40af' }}><Icons.Luggage /></div>
            <h3 style={styles.cardTitle}>Hành lý & Quy định</h3>
          </div>
          <div style={styles.baggageBox}>
            <div style={styles.baggageHighlight}>{baggage.carryOn}</div>
            <p style={styles.baggageDetail}>{baggage.detail}</p>
            <div style={styles.baggageWarning}>
              <strong>Lưu ý: </strong> {baggage.checkinRef}
            </div>
          </div>
        </div>

        {/* Card 4: Checklist chuẩn bị */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.iconBox, background: '#dcfce7', color: '#166534' }}><Icons.Checklist /></div>
            <h3 style={styles.cardTitle}>Checklist ra sân bay</h3>
          </div>
          <div style={styles.progressWrap}>
            <div style={styles.progressBar}><div style={{ ...styles.progressFill, width: `${progress}%` }}></div></div>
            <span style={styles.progressText}>{progress}%</span>
          </div>
          <div style={styles.checklist}>
            {checklist.map(item => (
              <label key={item.id} style={{ ...styles.checkItem, opacity: item.checked ? 0.6 : 1 }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleCheck(item.id)}
                  style={styles.checkbox}
                />
                <span style={{ textDecoration: item.checked ? 'line-through' : 'none', flex: 1, lineHeight: 1.4 }}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  container: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    background: '#f8fafc',
    borderRadius: '24px',
    padding: '24px',
    color: '#0f172a',
    marginTop: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0'
  },
  title: {
    margin: '0 0 6px 0',
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#0f62fe'
  },
  subtitle: {
    margin: '0 0 20px 0',
    color: '#64748b',
    fontSize: '0.95rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  iconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#e0e7ff',
    color: '#4f46e5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  routeBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    background: '#f1f5f9',
    padding: '16px',
    borderRadius: '12px'
  },
  airportCode: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  flightLine: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    color: '#94a3b8'
  },
  durationBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    background: '#ffffff',
    padding: '2px 8px',
    borderRadius: '99px',
    border: '1px solid #e2e8f0',
    marginBottom: '4px',
    zIndex: 2
  },
  line: {
    position: 'absolute',
    top: '70%',
    left: 0,
    right: 0,
    height: '2px',
    background: 'currentColor',
    borderStyle: 'dashed',
    zIndex: 1
  },
  flightMeta: {
    textAlign: 'center',
    fontSize: '0.9rem',
    color: '#64748b'
  },
  timeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'relative'
  },
  timeRow: {
    display: 'flex',
    gap: '14px',
    position: 'relative'
  },
  timeDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#f59e0b',
    marginTop: '6px',
    border: '2px solid #fff',
    boxShadow: '0 0 0 2px #fde68a'
  },
  timeContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  timeLabel: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  timeValue: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: '#0f172a'
  },
  timeHint: {
    fontSize: '0.85rem',
    color: '#94a3b8'
  },
  mutedText: {
    color: '#94a3b8',
    fontSize: '0.9rem'
  },
  baggageBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  baggageHighlight: {
    display: 'inline-block',
    alignSelf: 'flex-start',
    background: '#eff6ff',
    color: '#2563eb',
    padding: '6px 12px',
    borderRadius: '8px',
    fontWeight: 800,
    fontSize: '0.95rem'
  },
  baggageDetail: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#475569',
    lineHeight: 1.5
  },
  baggageWarning: {
    marginTop: '6px',
    padding: '10px 12px',
    background: '#fef2f2',
    color: '#991b1b',
    borderRadius: '8px',
    fontSize: '0.85rem',
    border: '1px solid #fecaca'
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  progressBar: {
    flex: 1,
    height: '6px',
    background: '#e2e8f0',
    borderRadius: '99px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#10b981',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#10b981',
    width: '32px'
  },
  checklist: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'opacity 0.2s',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#334155'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#10b981',
    marginTop: '1px',
    cursor: 'pointer'
  }
};
