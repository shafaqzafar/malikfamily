import type { PrescriptionPdfData } from './prescriptionPdf'

type RxPdfExtras = {
  tokenNo?: string
  mrn?: string
  computerNo?: string
  outdoorNo?: string
  wo?: string
  clinicalNotes?: string
  investigations?: string
  provisionalDiagnosis?: string
}

async function generateHospitalRxPdfInstance(data: PrescriptionPdfData & RxPdfExtras) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()

  const black = { r: 0, g: 0, b: 0 }
  const gray = { r: 100, g: 116, b: 139 }

  const settings = data.settings || {}
  const patient = data.patient || {}
  const doctor = data.doctor || {} as any
  const dt = data.createdAt ? new Date(data.createdAt as any) : new Date()

  const marginX = 15
  let y = 12

  // Header
  pdf.setTextColor(black.r, black.g, black.b)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.text(String(settings.name || 'SIALKOT MEDICAL COMPLEX'), W / 2, y + 6, { align: 'center' })
  y += 10

  const logo = String((settings as any).logoDataUrl || '')
  const docStartY = y

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text(String(doctor.name ? `Dr ${doctor.name}` : 'Dr Waris Ali Rana'), marginX, y)
  y += 5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(String(doctor.specialization || 'Medical Specialist'), marginX, y)
  y += 4
  pdf.text(String(doctor.qualification || 'MBBS, FCPS'), marginX, y)
  y += 8

  if (logo) {
    try {
      const normalized = await ensurePngDataUrl(logo)
      pdf.addImage(normalized, 'PNG' as any, W - marginX - 20, docStartY - 5, 18, 18, undefined, 'FAST')
    } catch { }
  }

  pdf.setDrawColor(black.r, black.g, black.b)
  pdf.setLineWidth(0.5)
  pdf.line(marginX, y, W - marginX, y)
  y += 6

  // Patient Info Box (Exactly like your picture)
  const boxPadding = 5
  const boxH = 35
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.setFillColor(248, 250, 252) // slate-50
  pdf.roundedRect(marginX, y, W - 2 * marginX, boxH, 3, 3, 'FD')

  let boxY = y + 6
  const col1 = marginX + boxPadding
  const col2 = marginX + (W - 2 * marginX) / 3 + 2
  const col3 = marginX + 2 * (W - 2 * marginX) / 3 + 4

  const labelSize = 7
  const valSize = 9

  const drawField = (label: string, value: string, x: number, py: number) => {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(labelSize)
    pdf.setTextColor(gray.r, gray.g, gray.b)
    pdf.text(label, x, py)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(valSize)
    pdf.setTextColor(black.r, black.g, black.b)
    pdf.text(String(value || '-'), x, py + 4)
  }

  drawField('Patient', String(patient.name || ''), col1, boxY)
  drawField('MR#', String(data.mrn || patient.mrn || ''), col2, boxY)
  drawField('Gender', String(patient.gender || ''), col3, boxY)

  boxY += 10
  drawField('Father Name', String(patient.fatherName || ''), col1, boxY)
  drawField('Age', String(patient.age || ''), col2, boxY)
  drawField('Phone', String(patient.phone || ''), col3, boxY)

  boxY += 10
  drawField('Address', String(patient.address || ''), col1, boxY)
  drawField('Date', dt.toLocaleString(), col3, boxY)

  y += boxH + 8

  // Content Sections
  const drawSection = (title: string, content: string) => {
    if (!content || content.trim() === '-' || content.trim() === '') return
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(black.r, black.g, black.b)
    pdf.text(title, marginX, y)
    y += 5

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const lines = pdf.splitTextToSize(String(content), W - 2 * marginX - 10)
    pdf.text(lines, marginX + 2, y)
    y += (lines.length * 5) + 5
  }

  drawSection('Medical History', String(data.history || ''))
  drawSection('Complaint', String(data.primaryComplaint || ''))
  drawSection('Examination', String(data.examFindings || ''))
  drawSection('Clinical Notes', String(data.primaryComplaintHistory || ''))
  drawSection('Advice', String(data.advice || ''))

  // Medication Table
  if (data.items && data.items.length > 0) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.text('Medication', marginX, y)
    y += 4

    const tableHead = [['Sr.', 'Drug', 'Freq', 'Dose', 'Dur', 'Inst', 'Route']]
    const tableBody = data.items.map((it: any, i: number) => [
      i + 1,
      it.name || '',
      it.frequency || '',
      it.dose || '',
      it.duration || '',
      it.instruction || '',
      it.route || ''
    ])

    const { default: autoTable } = await import('jspdf-autotable')
    autoTable(pdf, {
      startY: y,
      head: tableHead,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      margin: { left: marginX, right: marginX },
      didDrawPage: (d: any) => { y = d.cursor.y }
    })
    y += 10
  }

  // Footer
  const footerY = H - 18
  pdf.setDrawColor(black.r, black.g, black.b)
  pdf.setLineWidth(0.5)
  pdf.line(marginX, footerY, W - marginX, footerY)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(black.r, black.g, black.b)
  pdf.text(String(settings.address || 'COMMISSIONER ROAD, SIALKOT'), W / 2, footerY + 5, { align: 'center' })
  if (settings.phone) {
    pdf.setFontSize(8)
    pdf.text(`PH: ${String(settings.phone)}`, W / 2, footerY + 9, { align: 'center' })
  }

  return pdf
}

export async function previewHospitalRxPdf(data: PrescriptionPdfData & RxPdfExtras) {
  const pdf = await generateHospitalRxPdfInstance(data)
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => {
      document.body.removeChild(iframe)
      URL.revokeObjectURL(url)
    }, 1000)
  }
}

export async function downloadHospitalRxPdf(data: PrescriptionPdfData & RxPdfExtras, fileName?: string) {
  const pdf = await generateHospitalRxPdfInstance(data)
  const patient = data.patient || {}
  const dt = data.createdAt ? new Date(data.createdAt as any) : new Date()
  const fn = String(fileName || `Prescription_${String(data.mrn || patient.mrn || '').trim() || 'patient'}_${dt.toISOString().slice(0, 10)}.pdf`)
  pdf.save(fn)
}

async function ensurePngDataUrl(src: string): Promise<string> {
  try {
    if (/^data:image\/(png|jpeg|jpg)/i.test(src)) return src
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
  } catch { return src }
}
