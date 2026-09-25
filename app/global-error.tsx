"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="id"><body style={{ fontFamily:"system-ui,sans-serif", margin:0, padding:24, background:"#0b0b0f", color:"#fff" }}><main style={{ maxWidth:640, margin:"18vh auto", textAlign:"center" }}><h1 style={{ fontSize:32 }}>Licia perlu dimuat ulang</h1><p style={{ opacity:.72, lineHeight:1.6 }}>Terjadi kesalahan yang tidak dapat dipulihkan pada halaman ini.</p><button onClick={() => reset()} style={{ marginTop:16, border:0, borderRadius:12, padding:"12px 18px", cursor:"pointer" }}>Muat ulang</button></main></body></html>;
}
