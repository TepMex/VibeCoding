import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const pageWidthMm = 210
const pageHeightMm = 297

const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })

const getScale = () => {
  const ratio = window.devicePixelRatio || 1
  return Math.min(ratio, 2)
}

const pad2 = (value: number) => String(value).padStart(2, '0')

export const buildCopybookFilename = (hanziList: string[]) => {
  const now = new Date()
  const timestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(
    now.getDate(),
  )}${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  const hanziPreview = hanziList.join('').slice(0, 10).trim()
  const namePart = hanziPreview.length > 0 ? ` ${hanziPreview}` : ''
  return `${timestamp}${namePart} Copybook.pdf`
}

export const downloadCopybookPdf = async (filename: string) => {
  const pages = Array.from(
    document.querySelectorAll<HTMLElement>('.copybook-page'),
  )
  if (pages.length === 0) return

  if ('fonts' in document) {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready
  }
  await nextFrame()

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const scale = getScale()

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const canvas = await html2canvas(page, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
    })
    const imageData = canvas.toDataURL('image/png')

    if (index > 0) {
      pdf.addPage()
    }
    pdf.addImage(imageData, 'PNG', 0, 0, pageWidthMm, pageHeightMm)
  }

  pdf.save(filename)
}
