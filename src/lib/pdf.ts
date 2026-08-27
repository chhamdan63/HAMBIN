/* One-click PDF download for invoices / quotations / statements.
   Renders the branded document into an off-screen node and rasterises it
   with html2pdf.js so the client gets a real downloadable file (not just
   the browser print dialog). */

import { createElement } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";

export async function downloadPdf<P>(
  Component: ComponentType<P>,
  props: P,
  fileName: string,
): Promise<void> {
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = "794px"; /* A4 @ 96dpi */
  holder.style.background = "#ffffff";
  holder.style.zIndex = "-1";
  document.body.appendChild(holder);

  const root = createRoot(holder);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  root.render(createElement(Component as ComponentType<any>, props as any));

  /* let React paint */
  await new Promise((r) => window.setTimeout(r, 120));

  /* html2pdf.js has no TS typings — loaded lazily to keep first paint fast */
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { default: html2pdf } = await import("html2pdf.js");

  const node = holder.firstElementChild as HTMLElement;
  /* mirror the printed page: pin the contact footer to the absolute bottom.
     A4 printable height at 96dpi with 10mm margins ≈ 1047px. */
  node.style.display = "flex";
  node.style.flexDirection = "column";
  node.style.minHeight = "1047px";
  const foot = node.querySelector<HTMLElement>(".print-doc-footer");
  if (foot) foot.style.marginTop = "auto";

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: "jpeg", quality: 0.97 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(node)
    .save();

  root.unmount();
  holder.remove();
}
