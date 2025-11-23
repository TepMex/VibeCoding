import JSZip from "jszip";

export async function parseTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file, "UTF-8");
  });
}

export async function parseHtmlFile(file: File): Promise<string> {
  const htmlContent = await parseTextFile(file);
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");
  
  const body = doc.body;
  if (!body) return htmlContent;
  
  return body.textContent || body.innerText || "";
}

export async function parseEpubFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) {
    throw new Error("Invalid EPUB: container.xml not found");
  }
  
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "text/xml");
  const rootfileElement = containerDoc.querySelector("rootfile[media-type='application/oebps-package+xml']");
  const opfPath = rootfileElement?.getAttribute("full-path");
  
  if (!opfPath) {
    throw new Error("Invalid EPUB: OPF file not found");
  }
  
  const opfContent = await zip.file(opfPath)?.async("string");
  if (!opfContent) {
    throw new Error("Invalid EPUB: OPF file could not be read");
  }
  
  const opfDoc = parser.parseFromString(opfContent, "text/xml");
  const manifestItems = opfDoc.querySelectorAll("manifest > item[media-type='application/xhtml+xml'], manifest > item[media-type='text/html']");
  
  const basePath = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);
  const textParts: string[] = [];
  
  for (const item of Array.from(manifestItems)) {
    const href = item.getAttribute("href");
    if (!href) continue;
    
    const fullPath = basePath + href;
    const htmlContent = await zip.file(fullPath)?.async("string");
    if (htmlContent) {
      const htmlDoc = parser.parseFromString(htmlContent, "text/html");
      const body = htmlDoc.body;
      if (body) {
        const text = body.textContent || body.innerText || "";
        textParts.push(text);
      }
    }
  }
  
  return textParts.join("\n\n");
}

export async function parseFb2File(file: File): Promise<string> {
  const xmlContent = await parseTextFile(file);
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "text/xml");
  
  const body = doc.querySelector("body");
  if (!body) {
    return "";
  }
  
  const sections = body.querySelectorAll("section");
  const textParts: string[] = [];
  
  sections.forEach((section) => {
    const paragraphs = section.querySelectorAll("p");
    paragraphs.forEach((p) => {
      const text = p.textContent || "";
      if (text.trim()) {
        textParts.push(text.trim());
      }
    });
  });
  
  if (textParts.length === 0) {
    const paragraphs = body.querySelectorAll("p");
    paragraphs.forEach((p) => {
      const text = p.textContent || "";
      if (text.trim()) {
        textParts.push(text.trim());
      }
    });
  }
  
  return textParts.join("\n\n");
}

export async function parseFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  
  switch (extension) {
    case "txt":
      return parseTextFile(file);
    case "html":
    case "htm":
      return parseHtmlFile(file);
    case "epub":
      return parseEpubFile(file);
    case "fb2":
      return parseFb2File(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

