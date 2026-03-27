// --- FlightAssistantVanilla.js ---

window.FlightAssistantVanilla = (function() {
  // Styles
  const styleStr = `
    .fa-container { font-family: "Plus Jakarta Sans", sans-serif; background: #f8fafc; border-radius: 20px; padding: 20px; color: #0f172a; margin-top: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .fa-title { margin: 0 0 6px 0; font-size: 1.3rem; font-weight: 800; color: #0f62fe; }
    .fa-subtitle { margin: 0 0 16px 0; color: #64748b; font-size: 0.9rem; }
    .fa-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .fa-card { background: #ffffff; border-radius: 14px; padding: 18px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
    .fa-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .fa-icon-box { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #e0e7ff; color: #4f46e5; }
    .fa-card-title { margin: 0; font-size: 1rem; font-weight: 700; }
    .fa-route-box { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: #f1f5f9; padding: 14px; border-radius: 10px; margin-bottom: 10px; }
    .fa-airport { font-size: 1.4rem; font-weight: 800; color: #0f172a; }
    .fa-flight-line { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; color: #94a3b8; }
    .fa-duration { font-size: 0.75rem; font-weight: 700; background: #fff; padding: 2px 8px; border-radius: 99px; border: 1px solid #e2e8f0; margin-bottom: 4px; z-index: 2; }
    .fa-line { position: absolute; top: 70%; left: 0; right: 0; height: 2px; background: currentColor; border-style: dashed; z-index: 1; }
    .fa-flight-meta { text-align: center; font-size: 0.9rem; color: #64748b; }
    .fa-time-list { display: flex; flex-direction: column; gap: 14px; position: relative; }
    .fa-time-row { display: flex; gap: 12px; position: relative; }
    .fa-time-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #fff; margin-top: 6px; }
    .fa-time-content { display: flex; flex-direction: column; gap: 2px; }
    .fa-time-label { font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .fa-time-value { font-size: 1.05rem; font-weight: 800; color: #0f172a; }
    .fa-time-hint { font-size: 0.85rem; color: #94a3b8; }
    .fa-baggage-box { display: flex; flex-direction: column; gap: 8px; }
    .fa-baggage-hl { display: inline-block; align-self: flex-start; background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 0.9rem; }
    .fa-baggage-detail { margin: 0; font-size: 0.88rem; color: #475569; line-height: 1.5; }
    .fa-baggage-warn { margin-top: 6px; padding: 10px 12px; background: #fef2f2; color: #991b1b; border-radius: 8px; font-size: 0.85rem; border: 1px solid #fecaca; }
    .fa-progress-wrap { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
    .fa-progress-bar { flex: 1; height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
    .fa-progress-fill { height: 100%; background: #10b981; transition: width 0.3s ease; width: 0%; }
    .fa-progress-text { font-size: 0.85rem; font-weight: 700; color: #10b981; width: 32px; }
    .fa-checklist { display: flex; flex-direction: column; gap: 8px; }
    .fa-check-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px; border-radius: 8px; cursor: pointer; background: #f8fafc; transition: opacity 0.2s; font-size: 0.88rem; font-weight: 600; color: #334155; }
    .fa-check-item.checked { opacity: 0.6; }
    .fa-check-item.checked span { text-decoration: line-through; }
    .fa-checkbox { width: 16px; height: 16px; accent-color: #10b981; margin-top: 1px; cursor: pointer; }
  `;

  // Inject CSS
  if (typeof document !== 'undefined') {
    const styleBlock = document.createElement('style');
    styleBlock.textContent = styleStr;
    document.head.appendChild(styleBlock);
  }

  // Icons SVG Set
  const svgFlight = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6.8 3.4L6.5 14.7 3.6 14l-1.6 1.6 4.3 2 2.1 4.2 1.6-1.5-.7-2.9 3.2-3.3 3.5 6.7c.4.6.8.8 1.4.6l.8-.8c.4-.2.4-.7.3-1.2z"/></svg>';
  const svgClock = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  const svgLuggage = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 20h12"/><path d="M8 20V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12"/><path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/><path d="M8 12h8"/><path d="M8 16h8"/></svg>';
  const svgChecklist = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
  const svgArrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  // Logistics Methods
  function calculateDuration(dep, arr) {
    if (!dep || !arr) return '--';
    const d1 = new Date(typeof dep === 'object' ? (dep.local || dep.utc || dep.scheduledTimeLocal || dep.scheduledTimeUtc) : String(dep).replace(' ', 'T'));
    const d2 = new Date(typeof arr === 'object' ? (arr.local || arr.utc || arr.scheduledTimeLocal || arr.scheduledTimeUtc) : String(arr).replace(' ', 'T'));
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '--';
    const diffMs = d2.getTime() - d1.getTime();
    if (diffMs <= 0) return '--';
    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }

  function getCheckInTimes(dep) {
    if (!dep) return null;
    const d1 = new Date(typeof dep === 'object' ? (dep.local || dep.utc || dep.scheduledTimeLocal || dep.scheduledTimeUtc) : String(dep).replace(' ', 'T'));
    if (isNaN(d1.getTime())) return null;
    const onlineCheckin = new Date(d1.getTime() - 24 * 3600000);
    const airportArrival = new Date(d1.getTime() - 2 * 3600000);

    const pad = n => String(n).padStart(2, '0');
    const formatTime = ts => `${pad(ts.getHours())}:${pad(ts.getMinutes())} (${pad(ts.getDate())}/${pad(ts.getMonth() + 1)})`;
    return {
      online: formatTime(onlineCheckin),
      airport: formatTime(airportArrival)
    };
  }

  function getBaggageRules(airlineStr, flightNumberStr) {
    const al = String(airlineStr || '').toLowerCase();
    const num = String(flightNumberStr || '').toLowerCase();
    const isVN = al.includes('vietnam airlines') || num.startsWith('vn');
    const isQH = al.includes('bamboo') || num.startsWith('qh');
    if (isVN) return { carryOn: '12kg Xách tay', detail: 'Tiêu chuẩn hạng phổ thông gồm 1 kiện 10kg và 1 phụ kiện 2kg.', checkinRef: 'Hành lý ký gửi: Thường từ 23kg (tùy theo hạng vé chi tiết).' };
    if (isQH) return { carryOn: '7kg Xách tay', detail: 'Kiện xách tay tối đa 7kg với kích thước chuẩn.', checkinRef: 'Hành lý ký gửi: Được tính theo từng hạng vé Eco/Plus/Business.' };
    return { carryOn: '7kg Xách tay', detail: 'Chỉ bao gồm 1 kiện 7kg xách tay tiêu chuẩn.', checkinRef: 'Hành lý ký gửi: Thường phải mua thêm. Kiểm tra kỹ mặt vé của bạn!' };
  }

  const checklistItems = [
    { id: 'id_doc', label: 'Giấy tờ tùy thân (CCCD / Hộ chiếu)' },
    { id: 'ticket', label: 'Vé điện tử (E-ticket) / Boarding pass' },
    { id: 'power_bank', label: 'Sạc dự phòng (Bắt buộc xách tay, không ký gửi)' },
    { id: 'med', label: 'Thuốc men cá nhân thiết yếu' }
  ];

  function getChecklistUI() {
    return checklistItems.map((item) => `
      <label class="fa-check-item">
        <input type="checkbox" class="fa-checkbox" onchange="FlightAssistantVanilla.toggleCheck(this)" />
        <span>${item.label}</span>
      </label>
    `).join('');
  }

  return {
    toggleCheck: function(checkbox) {
      const label = checkbox.closest('.fa-check-item');
      if (checkbox.checked) {
        label.classList.add('checked');
      } else {
        label.classList.remove('checked');
      }
      // Update progress
      const card = label.closest('.fa-card');
      const total = card.querySelectorAll('.fa-checkbox').length;
      const checked = card.querySelectorAll('.fa-checkbox:checked').length;
      const progress = Math.round((checked / total) * 100);
      card.querySelector('.fa-progress-fill').style.width = `${progress}%`;
      card.querySelector('.fa-progress-text').innerText = `${progress}%`;
    },
    render: function(containerId, flight) {
      const container = document.getElementById(containerId);
      if (!container || !flight) return;

      const duration = calculateDuration(flight.departure || flight.departureTime, flight.arrival || flight.arrivalTime);
      const times = getCheckInTimes(flight.departure || flight.departureTime);
      const baggage = getBaggageRules(flight.airline, flight.flightNumber);

      const timesHtml = times ? `
        <div class="fa-time-list">
          <div class="fa-time-row">
            <span class="fa-time-dot" style="background:#f59e0b; box-shadow:0 0 0 2px #fde68a"></span>
            <div class="fa-time-content">
               <span class="fa-time-label">Mở Check-in Online</span>
               <strong class="fa-time-value">${times.online}</strong>
               <span class="fa-time-hint">Sẵn sàng điện thoại/máy tính để chọn chỗ.</span>
            </div>
          </div>
          <div class="fa-time-row">
            <span class="fa-time-dot" style="background:#ef4444; box-shadow:0 0 0 2px #fca5a5"></span>
            <div class="fa-time-content">
               <span class="fa-time-label">Có mặt sân bay (Chậm nhất)</span>
               <strong class="fa-time-value">${times.airport}</strong>
               <span class="fa-time-hint">Quầy làm thủ tục thường đóng trước 45-50 phút.</span>
            </div>
          </div>
        </div>
      ` : `<p style="color:#94a3b8;font-size:0.9rem">Không có dữ liệu giờ bay để tính toán.</p>`;

      container.innerHTML = `
        <div class="fa-container" onclick="event.stopPropagation()">
          <h2 class="fa-title">Flight Assistant</h2>
          <p class="fa-subtitle">Trợ lý du lịch mini giúp bạn chuẩn bị tốt nhất.</p>
          <div class="fa-grid">
            
            <!-- Hành trình -->
            <div class="fa-card">
              <div class="fa-card-header">
                <div class="fa-icon-box">${svgFlight}</div>
                <h3 class="fa-card-title">Tóm tắt hành trình</h3>
              </div>
              <div class="fa-route-box">
                <span class="fa-airport">${flight.origin || '---'}</span>
                <div class="fa-flight-line">
                  <span class="fa-duration">${duration}</span><div class="fa-line"></div>${svgArrow}
                </div>
                <span class="fa-airport">${flight.destination || '---'}</span>
              </div>
              <div class="fa-flight-meta"><strong>${flight.airline || 'Hãng bay'}</strong> · ${flight.flightNumber || 'N/A'}</div>
            </div>

            <!-- Check-in -->
            <div class="fa-card">
              <div class="fa-card-header">
                <div class="fa-icon-box" style="background:#fef08a;color:#854d0e">${svgClock}</div>
                <h3 class="fa-card-title">Nhắc giờ Check-in</h3>
              </div>
              ${timesHtml}
            </div>

            <!-- Hành lý -->
            <div class="fa-card">
              <div class="fa-card-header">
                <div class="fa-icon-box" style="background:#dbeafe;color:#1e40af">${svgLuggage}</div>
                <h3 class="fa-card-title">Hành lý quy định</h3>
              </div>
              <div class="fa-baggage-box">
                <div class="fa-baggage-hl">${baggage.carryOn}</div>
                <p class="fa-baggage-detail">${baggage.detail}</p>
                <div class="fa-baggage-warn"><strong>Lưu ý:</strong> ${baggage.checkinRef}</div>
              </div>
            </div>

            <!-- Checklist -->
            <div class="fa-card">
              <div class="fa-card-header">
                <div class="fa-icon-box" style="background:#dcfce7;color:#166534">${svgChecklist}</div>
                <h3 class="fa-card-title">Checklist ra sân bay</h3>
              </div>
              <div class="fa-progress-wrap">
                <div class="fa-progress-bar"><div class="fa-progress-fill"></div></div>
                <span class="fa-progress-text">0%</span>
              </div>
              <div class="fa-checklist">${getChecklistUI()}</div>
            </div>

          </div>
        </div>
      `;
    }
  };
})();
