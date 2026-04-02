import { labApi } from '../../api'

export type LabReportRow = { test: string; normal?: string; unit?: string; value?: string; prevValue?: string; flag?: 'normal'|'abnormal'|'critical'; comment?: string; profile?: string; details?: string }

export type LabReportInput = {
  tokenNo: string
  createdAt: string
  sampleTime?: string
  reportingTime?: string
  patient: { fullName: string; phone?: string; mrn?: string; age?: string; gender?: string; address?: string }
  rows: LabReportRow[]
  interpretation?: string
  printedBy?: string
  referringConsultant?: string
  profileLabel?: string
}

async function makeQrPng(text: string, size = 128): Promise<string> {
  try {
    const mod: any = await import('qrcode')
    const toDataURL: any = (mod && typeof mod.toDataURL === 'function') ? mod.toDataURL : (mod?.default?.toDataURL)
    if (typeof toDataURL === 'function') {
      const dataUrl = await toDataURL(String(text || ''), { errorCorrectionLevel: 'M', margin: 0, width: size })
      return String(dataUrl || '')
    }
  } catch {}
  return ''
}

async function makeBarcodePng(text: string): Promise<string> {
  try {
    const mod: any = await import('jsbarcode')
    const JsBarcode: any = (mod && typeof mod === 'function') ? mod : (mod?.default)
    if (typeof JsBarcode !== 'function') return ''

    const canvas = document.createElement('canvas')
    canvas.width = 520
    canvas.height = 160

    JsBarcode(canvas, String(text || ''), {
      format: 'CODE128',
      displayValue: false,
      margin: 0,
      width: 2,
      height: 70,
    })

    const out = canvas.toDataURL('image/png')
    return String(out || '')
  } catch {
    return ''
  }
}

async function ensurePngDataUrl(src: string): Promise<string> {
  try {
    if (/^data:image\/(png|jpeg)/i.test(src)) return src
    return await new Promise<string>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width || 200
          canvas.height = img.naturalHeight || img.height || 200
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0)
          const out = canvas.toDataURL('image/png')
          resolve(out || src)
        } catch { resolve(src) }
      }
      img.onerror = () => resolve(src)
      img.src = src
    })
  } catch {
    return src
  }
}

function fmtDateTime(iso?: string) {
  if (!iso) return '-'
  if (/^\d{1,2}:\d{2}$/.test(String(iso))) return String(iso)
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return String(iso)
    return d.toLocaleDateString() + ', ' + d.toLocaleTimeString()
  } catch {
    return String(iso)
  }
}

function fmtDateTimeWithBase(baseIso?: string, isoOrTime?: string) {
  if (!isoOrTime) return '-'
  if (/^\d{1,2}:\d{2}$/.test(String(isoOrTime)) && baseIso) {
    try {
      const d = new Date(baseIso)
      if (isNaN(d.getTime())) return String(isoOrTime)
      return d.toLocaleDateString() + ', ' + String(isoOrTime)
    } catch {
      return String(isoOrTime)
    }
  }
  return fmtDateTime(isoOrTime)
}

function drawFooter(doc: any, consultantsList: any[], printedBy: string | undefined, xL: number, xR: number) {
  const pageHeight = (doc.internal.pageSize as any).getHeight ? (doc.internal.pageSize as any).getHeight() : (doc.internal.pageSize as any).height
  const frameBottom = Math.min(pageHeight, 18 + 806)
  let baseY = frameBottom - 76
  doc.setFontSize(7.8)
  doc.setTextColor(0)
  doc.text('This is a Computer generated report. Signature(s) are not Necessary.', 297.5, baseY, { align: 'center' })
  doc.setDrawColor(0)
  doc.line(xL, baseY + 6, xR, baseY + 6)

  const tech = (printedBy || '').trim() ? { name: String(printedBy || ''), degrees: '', title: 'LAB TECHNICIAN' } : null
  const footerPeopleRaw: Array<{ name?: string; degrees?: string; title?: string }> = [...consultantsList]
  if (tech && footerPeopleRaw.length < 4 && !footerPeopleRaw.some(p => String(p?.name || '').trim() === tech.name.trim())) {
    footerPeopleRaw.splice(Math.min(1, footerPeopleRaw.length), 0, tech)
  }
  const footerPeople = footerPeopleRaw
    .filter(p => (p?.name || '').trim() || (p?.degrees || '').trim() || (p?.title || '').trim())
    .slice(0, 4)

  if (footerPeople.length) {
    const cols = footerPeople.length
    const colW = (xR - xL) / cols
    footerPeople.forEach((c, i) => {
      const x = xL + i * colW
      let yy = baseY + 18
      const cx = x + colW / 2
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.2)
      if ((c.name || '').trim()) { doc.text(String(c.name), cx, yy, { align: 'center' }); yy += 9 }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.6)
      if ((c.degrees || '').trim()) { doc.text(String(c.degrees), cx, yy, { align: 'center' }); yy += 8 }
      if ((c.title || '').trim()) { doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); doc.text(String(c.title), cx, yy, { align: 'center' }); doc.setFont('helvetica', 'normal') }
    })
  }
}

async function buildReceiptStyleDoc(input: LabReportInput, mode: 'preview'|'download') {
  const s: any = await labApi.getSettings().catch(() => ({}))
  const labName = s?.labName || 'NORTH RAVI HOSPITAL'
  const address = s?.address || '-'
  const phone = s?.phone || ''
  const email = s?.email || ''
  const department = s?.department || 'Department of Pathology'
  const logo = s?.logoDataUrl || ''
  const qrUrlTemplate = s?.qrUrl || ''
  const primaryConsultant = { name: s?.consultantName || '', degrees: s?.consultantDegrees || '', title: s?.consultantTitle || '' }
  const extraConsultants: Array<{ name?: string; degrees?: string; title?: string }> = Array.isArray(s?.consultants) ? s.consultants : []
  const consultantsList = [primaryConsultant, ...extraConsultants]
    .filter(c => (c?.name || '').trim() || (c?.degrees || '').trim() || (c?.title || '').trim())
    .slice(0, 4)

  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default as any

  const doc = new jsPDF('p', 'pt', 'a4')
  doc.setFont('helvetica', 'normal')

  const pageW = 595
  const xL = 32
  const xR = 563
  let y = 22

  // Page border
  doc.setDrawColor(0)
  doc.setLineWidth(1)
  doc.rect(20, 18, 555, 806)

  const fitText = (text: string, maxW: number) => {
    const s = String(text || '')
    if (!s) return ''
    if (doc.getTextWidth(s) <= maxW) return s
    let out = s
    while (out.length > 1 && doc.getTextWidth(out + '…') > maxW) out = out.slice(0, -1)
    return out.length < s.length ? (out + '…') : out
  }

  // Header (hospital)
  if (logo) {
    try {
      const normalized = await ensurePngDataUrl(logo)
      doc.addImage(normalized, 'PNG' as any, xL + 2, y + 2, 44, 44, undefined, 'FAST')
    } catch {}
  }

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(String(labName).toUpperCase(), (xL + xR) / 2, y + 18, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(fitText(String(address), xR - xL - 20), (xL + xR) / 2, y + 30, { align: 'center' })
  doc.text(fitText(`Ph: ${phone || ''}${email ? '  ' + email : ''}`, xR - xL - 20), (xL + xR) / 2, y + 40, { align: 'center' })

  y += 50
  doc.setDrawColor(0)
  doc.setLineWidth(0.8)
  doc.line(xL, y, xR, y)
  y += 8

  // Patient report band
  doc.setFillColor(238, 238, 238)
  doc.rect(xL, y, xR - xL, 18, 'F')
  doc.setDrawColor(0)
  doc.rect(xL, y, xR - xL, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text('PATIENT REPORT', (xL + xR) / 2, y + 13, { align: 'center' })
  y += 22

  // Patient info 3-column block
  const blockH = 86
  const blockW = xR - xL
  const leftW = 210
  const midW = 120
  const rightW = blockW - leftW - midW
  doc.setDrawColor(0)
  doc.setLineWidth(0.8)
  doc.rect(xL, y, blockW, blockH)
  doc.line(xL + leftW, y, xL + leftW, y + blockH)
  doc.line(xL + leftW + midW, y, xL + leftW + midW, y + blockH)

  const writeKV = (label: string, value: string, xx: number, yy: number, maxW: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, xx, yy)
    const lw = doc.getTextWidth(label + ' ')
    doc.setFont('helvetica', 'normal')
    doc.text(fitText(value, Math.max(10, maxW - lw)), xx + lw, yy)
  }

  const patientNo = String(input.patient.mrn || input.tokenNo || '-').trim() || '-'
  const orderNo = String(input.tokenNo || '-').trim() || '-'

  // Left column: barcode + patient summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Patient No:', xL + 6, y + 12)
  doc.setFont('helvetica', 'normal')
  doc.text(patientNo, xL + 70, y + 12)

  try {
    const bc = await makeBarcodePng(patientNo)
    if (bc) {
      doc.addImage(bc, 'PNG' as any, xL + 6, y + 16, leftW - 12, 22, undefined, 'FAST')
    }
  } catch {}

  writeKV('Name:', String(input.patient.fullName || '-'), xL + 6, y + 48, leftW - 12)
  writeKV('Age/Gender:', `${String(input.patient.age || '')} / ${String(input.patient.gender || '')}`.trim(), xL + 6, y + 60, leftW - 12)
  writeKV('Phone:', String(input.patient.phone || '-'), xL + 6, y + 72, leftW - 12)
  writeKV('Reference:', String(input.referringConsultant || '-'), xL + 6, y + 84, leftW - 12)

  // Middle column: QR
  const qrSize = 56
  const qrX = xL + leftW + (midW - qrSize) / 2
  const qrY = y + (blockH - qrSize) / 2
  try {
    const qrData = qrUrlTemplate 
      ? qrUrlTemplate.replace(/\{\{tokenNo\}\}/g, input.tokenNo)
      : String(input.tokenNo || '')
    const qr = await makeQrPng(qrData, 256)
    if (qr) {
      doc.addImage(qr, 'PNG' as any, qrX, qrY, qrSize, qrSize, undefined, 'FAST')
    }
  } catch {}

  // Right column: order meta
  const rx = xL + leftW + midW + 6
  const rMax = rightW - 12
  writeKV('Order No:', orderNo, rx, y + 12, rMax)
  try {
    const bc2 = await makeBarcodePng(orderNo)
    if (bc2) {
      doc.addImage(bc2, 'PNG' as any, rx, y + 16, rMax, 18, undefined, 'FAST')
    }
  } catch {}
  writeKV('Location Name:', String(input.patient.address || '-'), rx, y + 44, rMax)
  writeKV('Collection Date/Time:', String(fmtDateTimeWithBase(input.createdAt, input.sampleTime || input.createdAt)), rx, y + 58, rMax)
  writeKV('Report Date/Time:', String(fmtDateTimeWithBase(input.createdAt, input.reportingTime || '-')), rx, y + 72, rMax)

  y = y + blockH + 10

  // Group rows by profile/department for display
  const groupByProfile = (rows: LabReportRow[]) => {
    const groups: Record<string, LabReportRow[]> = {}
    rows.forEach(row => {
      const profile = row.profile || input.profileLabel || department || 'DEPARTMENT OF PATHOLOGY'
      const deptName = /\bDEPARTMENT\b/i.test(profile) ? profile : `DEPARTMENT OF ${profile}`
      if (!groups[deptName]) groups[deptName] = []
      groups[deptName].push(row)
    })
    return groups
  }

  const profileGroups = groupByProfile(input.rows || [])
  const profiles = Object.keys(profileGroups)

  const allBody: any[] = []

  for (const profile of profiles) {
    const deptRows = profileGroups[profile]
    if (deptRows.length === 0) continue

    // Department band
    allBody.push([
      {
        content: profile.toUpperCase(),
        rowType: 'dept',
        colSpan: 5,
        styles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'left',
          lineWidth: 0.8,
          lineColor: [0, 0, 0],
        },
      },
    ])

    // Header row
    allBody.push([
      { content: 'Test Name', rowType: 'header', styles: { fontStyle: 'bold', lineWidth: 0.8, lineColor: [0, 0, 0] } },
      { content: 'Value', rowType: 'header', styles: { fontStyle: 'bold', halign: 'center', lineWidth: 0.8, lineColor: [0, 0, 0] } },
      { content: 'Unit', rowType: 'header', styles: { fontStyle: 'bold', halign: 'center', lineWidth: 0.8, lineColor: [0, 0, 0] } },
      { content: 'Reference Value', rowType: 'header', styles: { fontStyle: 'bold', halign: 'center', lineWidth: 0.8, lineColor: [0, 0, 0] } },
      { content: 'Remarks', rowType: 'header', styles: { fontStyle: 'bold', halign: 'center', lineWidth: 0.8, lineColor: [0, 0, 0] } },
    ])

    // Data rows
    deptRows.forEach(r => {
      allBody.push([
        { content: r.test || '', rowType: 'data' },
        { content: r.value || '', rowType: 'data', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: r.unit || '', rowType: 'data', styles: { halign: 'center' } },
        { content: r.normal || '', rowType: 'data', styles: { halign: 'center' } },
        { content: r.comment || '', rowType: 'data', styles: { halign: 'center' } },
      ])
    })
  }

  autoTable(doc, {
    startY: y,
    head: [['Test Name', 'Value', 'Unit', 'Reference Value', 'Remarks']],
    showHead: 'never',
    body: allBody,
    theme: 'plain',
    styles: { fontSize: 8.3, cellPadding: { top: 2.6, right: 2.6, bottom: 2.6, left: 2.6 }, lineWidth: 0, lineColor: [0, 0, 0], textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'left', valign: 'middle', fontStyle: 'bold', lineWidth: 0.8, lineColor: [0, 0, 0] },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.8,
    margin: { left: xL, right: pageW - xR, bottom: 140 },
    columnStyles: {
      0: { cellWidth: 240 },
      1: { cellWidth: 60, halign: 'center' },
      2: { cellWidth: 55, halign: 'center' },
      3: { cellWidth: 110, halign: 'center' },
      4: { cellWidth: 66, halign: 'right' },
    },
    didParseCell: (hook: any) => {
      try {
        if (hook.section !== 'body') return
        const rowRaw: any[] = hook.row?.raw
        const rt = (rowRaw && rowRaw[0] && rowRaw[0].rowType) || (hook.cell?.raw as any)?.rowType
        if (hook.column.index === 1) {
          hook.cell.styles.fontStyle = 'bold'
        }
        if (rt === 'dept' || rt === 'header' || rt === 'group') {
          hook.cell.styles.minCellHeight = 14
        }
      } catch {}
    },
    didDrawCell: (hook: any) => {
      try {
        if (hook.section !== 'body') return
        const rowRaw: any[] = hook.row?.raw
        const rt = (rowRaw && rowRaw[0] && rowRaw[0].rowType) || (hook.cell?.raw as any)?.rowType
        const x = hook.cell.x
        const y = hook.cell.y
        const w = hook.cell.width
        const h = hook.cell.height

        const isFirstRow = hook.row.index === 0
        const isLastRow = hook.row.index === (hook.table?.body?.length ? (hook.table.body.length - 1) : -1)
        const colIndex = hook.column.index
        const lastColIndex = (hook.table?.columns?.length ? (hook.table.columns.length - 1) : 4)

        hook.doc.setDrawColor(0)
        hook.doc.setLineWidth(0.6)
        hook.doc.line(x, y, x, y + h)
        if (colIndex === lastColIndex) {
          hook.doc.line(x + w, y, x + w, y + h)
        }

        if (colIndex === 0 && isFirstRow) {
          hook.doc.setLineWidth(0.8)
          hook.doc.line(x, y, x + w, y)
        }
        if (colIndex === 0 && isLastRow) {
          hook.doc.setLineWidth(0.8)
          hook.doc.line(x, y + h, x + w, y + h)
        }

        if (colIndex === 0 && (rt === 'dept' || rt === 'header' || rt === 'group')) {
          hook.doc.setLineWidth(0.8)
          hook.doc.line(x, y, x + w, y)
          hook.doc.line(x, y + h, x + w, y + h)
        }
      } catch {}
    },
  })

  if ((input.interpretation || '').trim()) {
    autoTable(doc, {
      startY: (((doc as any).lastAutoTable?.finalY) || (y + 12)) + 12,
      body: [
        [{ content: 'Clinical Interpretation:', styles: { fontStyle: 'bold' } }],
        [{ content: String(input.interpretation || '') }],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 0, halign: 'left' },
      margin: { left: 40, right: 40, bottom: 120 },
    })
  }

  const pages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    (doc as any).setPage(i)
    drawFooter(doc, consultantsList, input.printedBy, xL, xR)
  }

  if (mode === 'preview') {
    try {
      const api = (window as any).electronAPI
      if (api && typeof api.printPreviewPdf === 'function') {
        const dataUrl = doc.output('datauristring') as string
        await api.printPreviewPdf(dataUrl)
        return
      }
    } catch {}

    doc.autoPrint()
    const blob = doc.output('blob') as Blob
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    iframe.onload = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch {}
      setTimeout(() => { try { URL.revokeObjectURL(url); iframe.remove() } catch {} }, 10000)
    }
    iframe.src = url
    document.body.appendChild(iframe)
    return
  }

  const fileName = `lab-report-${(input.patient.mrn || '').replace(/\s+/g, '') || input.tokenNo}.pdf`
  doc.save(fileName)
}

export async function previewLabReportPdfReceiptStyle(input: LabReportInput) {
  return buildReceiptStyleDoc(input, 'preview')
}

export async function downloadLabReportPdfReceiptStyle(input: LabReportInput) {
  return buildReceiptStyleDoc(input, 'download')
}
