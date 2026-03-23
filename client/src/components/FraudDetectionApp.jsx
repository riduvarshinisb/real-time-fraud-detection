import { useState, useRef } from "react";

// ── ML scoring ────────────────────────────────────────────────────────────────
function computeRiskScore(tx) {
  let score = 0;
  if (tx.amount > 50000) score += 0.35;
  else if (tx.amount > 10000) score += 0.20;
  else if (tx.amount > 2000) score += 0.08;
  if (tx.locationMismatch) score += 0.25;
  const h = tx.hour;
  if (h >= 2 && h <= 5) score += 0.18;
  if (tx.velocity > 5) score += 0.22;
  else if (tx.velocity > 2) score += 0.10;
  if (tx.newDevice) score += 0.15;
  if (tx.category === "Crypto") score += 0.20;
  else if (tx.category === "International") score += 0.12;
  else if (tx.category === "Gambling") score += 0.18;
  score += (Math.random() - 0.5) * 0.04;
  return Math.min(1, Math.max(0, score));
}

function modelScores(score) {
  return {
    lr:  Math.min(1, Math.max(0, score * 0.88 + (Math.random() - 0.5) * 0.06)),
    rf:  Math.min(1, Math.max(0, score * 0.95 + (Math.random() - 0.5) * 0.04)),
    xgb: Math.min(1, Math.max(0, score * 1.02 + (Math.random() - 0.5) * 0.03)),
  };
}

function getDecision(score) {
  if (score < 0.35) return { label: "Auto Approve",  color: "#00c47a", bg: "#d6f5ea", darkBg: "#003d2a", icon: "✓" };
  if (score < 0.65) return { label: "Manual Review", color: "#e8920a", bg: "#fff3dc", darkBg: "#3d2a00", icon: "⚠" };
  return               { label: "Block & Alert",  color: "#e83a4a", bg: "#fde8ea", darkBg: "#3d0a00", icon: "✕" };
}

const CATEGORIES    = ["Retail","Food & Dining","Travel","Crypto","International","Gambling","Healthcare","Entertainment"];
const PAYMENT_TYPES = ["Credit Card","UPI Payments","Online Banking"];

const SAMPLE_TXS = [
  { amount: 450,   category: "Food & Dining",  locationMismatch: false, hour: 13, velocity: 1, newDevice: false, paymentType: "UPI Payments",  merchant: "Zomato"        },
  { amount: 78000, category: "Crypto",          locationMismatch: true,  hour: 3,  velocity: 7, newDevice: true,  paymentType: "Online Banking", merchant: "CoinSwitch"    },
  { amount: 15000, category: "International",   locationMismatch: true,  hour: 22, velocity: 3, newDevice: false, paymentType: "Credit Card",    merchant: "Amazon Global" },
  { amount: 2200,  category: "Retail",          locationMismatch: false, hour: 11, velocity: 2, newDevice: false, paymentType: "Credit Card",    merchant: "Flipkart"      },
  { amount: 35000, category: "Gambling",        locationMismatch: false, hour: 4,  velocity: 6, newDevice: true,  paymentType: "Online Banking", merchant: "BetWay"        },
];

function Gauge({ score, dark }) {
  const s     = Math.min(1, Math.max(0, score));
  const color = s < 0.35 ? "#00c47a" : s < 0.65 ? "#e8920a" : "#e83a4a";
  const cx = 110, cy = 90, r = 80;
  const sweepDeg  = s * 180;
  const angleDeg  = 180 - sweepDeg;
  const angleRad  = (angleDeg * Math.PI) / 180;
  const arcEndX   = cx + r * Math.cos(angleRad);
  const arcEndY   = cy - r * Math.sin(angleRad);
  const largeArc  = sweepDeg > 180 ? 1 : 0;
  const needleRad = angleRad;
  const nx = cx + 65 * Math.cos(needleRad);
  const ny = cy - 65 * Math.sin(needleRad);
  const bgTrack = dark ? "#252525" : "#e2e2e2";
  const subClr  = dark ? "#aaa"    : "#888";

  return (
    <svg viewBox="0 0 220 145" style={{ width: "100%", maxWidth: 280, display: "block" }}>
      {/* Track */}
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
        fill="none" stroke={bgTrack} strokeWidth="14" strokeLinecap="round" />

      {/* Active arc */}
      {s > 0.005 && (
        <path
          d={`M ${cx-r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${arcEndX.toFixed(3)} ${arcEndY.toFixed(3)}`}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          style={{ transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)" }}
        />
      )}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx.toFixed(3)} y2={ny.toFixed(3)}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
        style={{ transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1)" }} />
      <circle cx={cx} cy={cy} r="5" fill={color} style={{ transition: "fill 0.4s" }} />

      {/* Score */}
      <text x={cx} y={cy + 22} textAnchor="middle" fill={color}
        fontSize="26" fontFamily="'Space Mono',monospace" fontWeight="bold"
        style={{ transition: "fill 0.4s" }}>
        {(s * 100).toFixed(1)}
      </text>

      {/* RISK SCORE label */}
      <text x={cx} y={cy + 38} textAnchor="middle" fill={subClr} fontSize="9" fontFamily="monospace">
        RISK SCORE
      </text>

      {/* LOW / HIGH labels */}
      <text x={cx - r + 2} y={cy + 20} fill={subClr} fontSize="9" fontFamily="monospace">LOW</text>
      <text x={cx + r - 26} y={cy + 20} fill={subClr} fontSize="9" fontFamily="monospace">HIGH</text>
    </svg>
  );
}

function ModelBar({ label, value, dark }) {
  const color = value < 0.35 ? "#00c47a" : value < 0.65 ? "#e8920a" : "#e83a4a";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4,
        fontFamily:"monospace", color: dark?"#aaa":"#666" }}>
        <span>{label}</span>
        <span style={{ color }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ background: dark?"#1a1a1a":"#ebebeb", borderRadius:4, height:8, overflow:"hidden" }}>
        <div style={{ width:`${value*100}%`, background:color, height:"100%", borderRadius:4,
          transition:"width 0.7s cubic-bezier(.4,2,.6,1)" }} />
      </div>
    </div>
  );
}

function LogEntry({ tx, idx, dark }) {
  const d  = getDecision(tx.score);
  const bg = dark ? (idx%2===0?"#0c0c0c":"transparent") : (idx%2===0?"#f7f8fa":"transparent");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
      borderBottom:`1px solid ${dark?"#1a1a1a":"#eee"}`, fontSize:12,
      fontFamily:"monospace", background:bg, animation:"fadeSlide 0.4s ease" }}>
      <span style={{ color:dark?"#444":"#bbb", minWidth:28 }}>#{tx.id}</span>
      <span style={{ color:dark?"#fff":"#222", minWidth:90, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{tx.merchant}</span>
      <span style={{ color:dark?"#ccc":"#444", minWidth:72 }}>₹{tx.amount.toLocaleString()}</span>
      <span style={{ color:dark?"#666":"#999", minWidth:55, fontSize:10 }}>{tx.paymentType.split(" ")[0]}</span>
      <span style={{ minWidth:60, textAlign:"center", padding:"2px 8px", borderRadius:3,
        background:dark?d.darkBg:d.bg, color:d.color, fontSize:10, fontWeight:"bold" }}>
        {d.icon} {(tx.score*100).toFixed(0)}
      </span>
      <span style={{ color:d.color, fontSize:10, flex:1 }}>{d.label}</span>
    </div>
  );
}

function SliderField({ label, min, max, value, onChange, step=1, format, dark }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6, fontFamily:"monospace" }}>
        <span style={{ color:dark?"#ccc":"#444" }}>{label}</span>
        <span style={{ color:dark?"#fff":"#111", fontWeight:"bold" }}>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width:"100%", accentColor:"#00c47a", cursor:"pointer" }} />
    </div>
  );
}

function Toggle({ label, value, onChange, dark }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
      <span style={{ fontSize:12, color:dark?"#ccc":"#444", fontFamily:"monospace" }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width:40, height:22, borderRadius:11,
        background: value ? "#00c47a" : (dark?"#333":"#ccc"),
        position:"relative", cursor:"pointer", transition:"background 0.3s"
      }}>
        <div style={{ position:"absolute", top:3, left:value?20:3,
          width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.3s" }} />
      </div>
    </div>
  );
}

function Toast({ show, dark }) {
  if (!show) return null;
  return (
    <div style={{
      position:"fixed", bottom:36, left:"50%", transform:"translateX(-50%)",
      background: dark ? "#0d2b1e" : "#e8faf3",
      border:"2px solid #00c47a",
      color:"#00c47a",
      padding:"14px 36px", borderRadius:12,
      fontFamily:"'Space Mono',monospace", fontSize:13, fontWeight:"bold",
      boxShadow:"0 8px 40px rgba(0,196,122,0.25)",
      display:"flex", alignItems:"center", gap:12,
      zIndex:9999, animation:"toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1)"
    }}>
      <span style={{ fontSize:22, lineHeight:1 }}>✓</span>
      Transaction Logged Successfully!
    </div>
  );
}

export default function FraudDetectionApp() {
  const [dark, setDark]           = useState(true);
  const [tx, setTx]               = useState({ amount:5000, category:"Retail", locationMismatch:false, hour:14, velocity:1, newDevice:false, paymentType:"Credit Card", merchant:"Custom Transaction" });
  const [score, setScore]         = useState(null);
  const [models, setModels]       = useState(null);
  const [log, setLog]             = useState([]);
  const [txCounter, setTxCounter] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("engine");
  const [showToast, setShowToast] = useState(false);
  const logRef = useRef(null);

  const T = {
    bg:      dark ? "#050505" : "#f0f2f5",
    surface: dark ? "#0d0d0d" : "#ffffff",
    panel:   dark ? "#080808" : "#f7f8fa",
    border:  dark ? "#1e1e1e" : "#dde1e7",
    text:    dark ? "#f0f0f0" : "#1a1a2e",
    sub:     dark ? "#888"    : "#666",
    muted:   dark ? "#444"    : "#bbb",
    inBg:    dark ? "#111"    : "#f4f5f7",
    inBdr:   dark ? "#2a2a2a" : "#d8dce3",
    tabAct:  dark ? "#00c47a" : "#0055ff",
    tabIn:   dark ? "#555"    : "#999",
  };

  function analyze() {
    setAnalyzing(true);
    setTimeout(() => {
      const s = computeRiskScore(tx);
      const m = modelScores(s);
      setScore((m.lr + m.rf + m.xgb) / 3);
      setModels(m);
      setAnalyzing(false);
    }, 700);
  }

  function submitToDecision() {
    if (score === null) return;
    setLog(prev => [{ ...tx, score, id: txCounter, timestamp: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    setTxCounter(c => c + 1);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }

  const decision = score !== null ? getDecision(score) : null;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Space Mono',monospace", transition:"all 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#444;border-radius:2px;}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.35;}}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(24px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
        select{font-family:'Space Mono',monospace;font-size:11px;width:100%;cursor:pointer;outline:none;}
        button{transition:opacity 0.2s;}
        button:hover{opacity:0.85;}
      `}</style>

      <Toast show={showToast} dark={dark} />

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:"15px 32px",
        display:"flex", alignItems:"center", justifyContent:"space-between", background:T.panel }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#00c47a",
            boxShadow:"0 0 10px #00c47a55", animation:"pulse 2s infinite" }} />
          <span style={{ fontFamily:"'Bebas Neue'", fontSize:22, letterSpacing:3 }}>FRAUD SHIELD</span>
          <span style={{ fontSize:10, color:T.sub, letterSpacing:2 }}>ML DETECTION SYSTEM</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          <span style={{ fontSize:10, color:T.sub }}>LOGGED: <b style={{ color:T.text }}>{log.length}</b></span>
          <span style={{ fontSize:10, color:"#00c47a" }}>● ONLINE</span>
          <div style={{ display:"flex", alignItems:"center", gap:8, userSelect:"none" }}>
            <span style={{ fontSize:13 }}>🌙</span>
            <div onClick={() => setDark(d => !d)} style={{
              width:46, height:25, borderRadius:13,
              background: dark ? "#2a2a2a" : "#0055ff",
              position:"relative", cursor:"pointer", transition:"background 0.35s",
              border:`1px solid ${dark?"#444":"#0044dd"}`
            }}>
              <div style={{
                position:"absolute", top:3, left:dark?3:23,
                width:17, height:17, borderRadius:"50%",
                background:"#fff", transition:"left 0.3s"
              }} />
            </div>
            <span style={{ fontSize:13 }}>☀️</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom:`1px solid ${T.border}`, padding:"0 32px", background:T.panel,
        display:"flex", gap:0 }}>
        {[
          { id:"engine",   label:"ML ENGINE"       },
          { id:"decision", label:"DECISION"         },
          { id:"log",      label:`LOG (${log.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            background:"none", border:"none", borderBottom:`2px solid ${activeTab===tab.id?T.tabAct:"transparent"}`,
            color: activeTab===tab.id ? T.tabAct : T.tabIn,
            padding:"14px 20px", fontFamily:"monospace", fontSize:11,
            letterSpacing:2, cursor:"pointer", transition:"all 0.2s"
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Main content */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* ML ENGINE TAB */}
        {activeTab === "engine" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:28 }}>

            {/* Left: Input */}
            <div>
              <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:16 }}>TRANSACTION INPUT</div>

              {/* Sample buttons */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, color:T.muted, marginBottom:8 }}>LOAD SAMPLE TRANSACTION</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {SAMPLE_TXS.map((s,i) => (
                    <button key={i} onClick={() => { setTx({...s}); setScore(null); setModels(null); }} style={{
                      background:T.inBg, border:`1px solid ${T.inBdr}`, color:T.sub,
                      fontSize:9, padding:"4px 10px", borderRadius:4, cursor:"pointer", fontFamily:"monospace"
                    }}>{s.merchant}</button>
                  ))}
                </div>
              </div>

              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:22 }}>
                {/* Payment type */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:T.sub, marginBottom:6 }}>PAYMENT TYPE</div>
                  <select value={tx.paymentType} onChange={e=>setTx(p=>({...p,paymentType:e.target.value}))}
                    style={{ background:T.inBg, color:T.text, border:`1px solid ${T.inBdr}`, borderRadius:5, padding:"7px 10px" }}>
                    {PAYMENT_TYPES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Category */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:T.sub, marginBottom:6 }}>MERCHANT CATEGORY</div>
                  <select value={tx.category} onChange={e=>setTx(p=>({...p,category:e.target.value}))}
                    style={{ background:T.inBg, color:T.text, border:`1px solid ${T.inBdr}`, borderRadius:5, padding:"7px 10px" }}>
                    {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>

                <SliderField label="TRANSACTION AMOUNT (₹)" min={100} max={100000} step={100}
                  value={tx.amount} onChange={v=>setTx(p=>({...p,amount:v}))}
                  format={v=>`₹${v.toLocaleString()}`} dark={dark} />
                <SliderField label="HOUR OF DAY" min={0} max={23}
                  value={tx.hour} onChange={v=>setTx(p=>({...p,hour:v}))}
                  format={v=>`${v}:00 ${v<12?"AM":"PM"}`} dark={dark} />
                <SliderField label="VELOCITY (txns / hour)" min={1} max={10}
                  value={tx.velocity} onChange={v=>setTx(p=>({...p,velocity:v}))} dark={dark} />
                <Toggle label="LOCATION MISMATCH" value={tx.locationMismatch}
                  onChange={v=>setTx(p=>({...p,locationMismatch:v}))} dark={dark} />
                <Toggle label="NEW DEVICE" value={tx.newDevice}
                  onChange={v=>setTx(p=>({...p,newDevice:v}))} dark={dark} />

                <button onClick={analyze} disabled={analyzing} style={{
                  width:"100%", padding:"12px",
                  background: analyzing ? T.inBg : "#00c47a",
                  color: analyzing ? T.sub : "#000",
                  border:"none", borderRadius:7, fontFamily:"monospace", fontSize:13,
                  fontWeight:"bold", letterSpacing:2, cursor:analyzing?"not-allowed":"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:4
                }}>
                  {analyzing ? (
                    <>
                      <span style={{ display:"inline-block", width:14, height:14,
                        border:`2px solid ${T.sub}`, borderTopColor:"#00c47a",
                        borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                      ANALYZING...
                    </>
                  ) : "▶  RUN FRAUD ANALYSIS"}
                </button>
              </div>
            </div>

            {/* Right: Output */}
            <div>
              <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:16 }}>MODEL OUTPUT</div>

              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:24, marginBottom:16 }}>
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <Gauge score={score ?? 0} dark={dark} />
                </div>
                {score === null && (
                  <p style={{ textAlign:"center", color:T.muted, fontSize:11, marginTop:6 }}>
                    Configure parameters and run analysis
                  </p>
                )}
                {score !== null && decision && (
                  <div style={{ textAlign:"center", marginTop:10 }}>
                    <span style={{
                      background: dark ? decision.darkBg : decision.bg,
                      color:decision.color, padding:"5px 18px",
                      borderRadius:20, fontSize:12, fontWeight:"bold", letterSpacing:1
                    }}>{decision.icon}  {decision.label}</span>
                  </div>
                )}
              </div>

              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:20, marginBottom:16 }}>
                <div style={{ fontSize:10, color:T.sub, letterSpacing:1, marginBottom:14 }}>INDIVIDUAL MODEL SCORES</div>
                <ModelBar label="Logistic Regression" value={models?.lr  ?? 0} dark={dark} />
                <ModelBar label="Random Forest"        value={models?.rf  ?? 0} dark={dark} />
                <ModelBar label="XGBoost"              value={models?.xgb ?? 0} dark={dark} />
                {models && (
                  <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, marginTop:6 }}>
                    <ModelBar label="ENSEMBLE (avg)" value={score} dark={dark} />
                  </div>
                )}
              </div>

              {score !== null && (
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:20 }}>
                  <div style={{ fontSize:10, color:T.sub, letterSpacing:1, marginBottom:14 }}>RISK FACTORS DETECTED</div>
                  {[
                    { label:"Amount",   value:tx.amount>50000?"HIGH (>₹50k)":tx.amount>10000?"MEDIUM":"LOW", risk:tx.amount>10000 },
                    { label:"Location", value:tx.locationMismatch?"MISMATCH DETECTED":"OK",                  risk:tx.locationMismatch },
                    { label:"Time",     value:tx.hour>=2&&tx.hour<=5?`SUSPICIOUS (${tx.hour}:00)`:"NORMAL",  risk:tx.hour>=2&&tx.hour<=5 },
                    { label:"Velocity", value:tx.velocity>5?`HIGH (${tx.velocity}/hr)`:"NORMAL",             risk:tx.velocity>5 },
                    { label:"Device",   value:tx.newDevice?"NEW DEVICE":"KNOWN",                             risk:tx.newDevice },
                    { label:"Category", value:tx.category,                                                   risk:["Crypto","Gambling","International"].includes(tx.category) },
                  ].map(f => (
                    <div key={f.label} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:7, fontFamily:"monospace" }}>
                      <span style={{ color:T.sub }}>{f.label}</span>
                      <span style={{ color:f.risk?"#e83a4a":"#00c47a" }}>{f.value}</span>
                    </div>
                  ))}
                  <button onClick={() => { submitToDecision(); setActiveTab("decision"); }} style={{
                    width:"100%", marginTop:14, padding:"10px",
                    background:dark?"#1a1a0a":"#fffbe6",
                    color:"#e8920a", border:`1px solid ${dark?"#3d2a00":"#f5c262"}`,
                    borderRadius:6, fontFamily:"monospace", fontSize:11, letterSpacing:1, cursor:"pointer"
                  }}>→  SEND TO DECISION MODULE</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DECISION TAB */}
        {activeTab === "decision" && (
          <div>
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:16 }}>CURRENT TRANSACTION DECISION</div>
              {score === null ? (
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10,
                  padding:48, textAlign:"center", color:T.muted, fontSize:13 }}>
                  No transaction analyzed yet. Go to the{" "}
                  <span style={{ color:"#00c47a", cursor:"pointer" }} onClick={()=>setActiveTab("engine")}>ML ENGINE</span> tab first.
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                  {[
                    { label:"Auto Approve",  color:"#00c47a", bg:"#e6f9f0", darkBg:"#003d2a", icon:"✓", threshold:"Score < 0.35",       active:score<0.35,             action:"Transaction cleared. Funds released instantly."        },
                    { label:"Manual Review", color:"#e8920a", bg:"#fff3dc", darkBg:"#3d2a00", icon:"⚠", threshold:"0.35 ≤ Score < 0.65", active:score>=0.35&&score<0.65,action:"Transaction held. Analyst notified for review."         },
                    { label:"Block & Alert", color:"#e83a4a", bg:"#fde8ea", darkBg:"#3d0a00", icon:"✕", threshold:"Score ≥ 0.65",        active:score>=0.65,            action:"Transaction blocked. Customer SMS + email alert sent." },
                  ].map(d => (
                    <div key={d.label} style={{
                      border:`2px solid ${d.active?d.color:T.border}`,
                      borderRadius:10, padding:24,
                      background:d.active?(dark?d.darkBg:d.bg):T.surface,
                      transition:"all 0.4s", position:"relative", overflow:"hidden"
                    }}>
                      {d.active && (
                        <div style={{ position:"absolute", top:0, right:0, width:0, height:0,
                          borderStyle:"solid", borderWidth:"0 28px 28px 0",
                          borderColor:`transparent ${d.color} transparent transparent` }} />
                      )}
                      <div style={{ fontSize:30, marginBottom:10, color:d.active?d.color:T.muted }}>{d.icon}</div>
                      <div style={{ fontSize:13, fontWeight:"bold", color:d.active?d.color:T.muted, letterSpacing:1, marginBottom:5 }}>{d.label}</div>
                      <div style={{ fontSize:10, color:T.sub, marginBottom:8 }}>{d.threshold}</div>
                      {d.active && (
                        <div style={{ fontSize:11, color:dark?"#aaa":"#555", lineHeight:1.6,
                          borderTop:`1px solid ${d.color}44`, paddingTop:10 }}>{d.action}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {score !== null && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:28 }}>
                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:22 }}>
                  <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:16 }}>LOG EVENT</div>
                  {[["Merchant",tx.merchant],["Amount",`₹${tx.amount.toLocaleString()}`],["Type",tx.paymentType]].map(([k,v])=>(
                    <div key={k} style={{ fontSize:12, color:T.sub, marginBottom:7 }}>
                      {k}: <span style={{ color:T.text }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:12, color:T.sub, marginBottom:18 }}>
                    Score: <span style={{ color:decision?.color, fontWeight:"bold" }}>{(score*100).toFixed(2)}</span>
                  </div>
                  <button onClick={submitToDecision} style={{
                    width:"100%", padding:"12px",
                    background:"#00c47a", color:"#000",
                    border:"none", borderRadius:7, fontFamily:"monospace",
                    fontSize:12, fontWeight:"bold", letterSpacing:1, cursor:"pointer"
                  }}>✓  LOG THIS TRANSACTION</button>
                </div>

                <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:22 }}>
                  <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:16 }}>SESSION STATS</div>
                  {[
                    { label:"Total Logged",  value:log.length,                                        color:T.text    },
                    { label:"Auto Approved", value:log.filter(t=>t.score<0.35).length,                color:"#00c47a" },
                    { label:"Manual Review", value:log.filter(t=>t.score>=0.35&&t.score<0.65).length, color:"#e8920a" },
                    { label:"Blocked",       value:log.filter(t=>t.score>=0.65).length,               color:"#e83a4a" },
                  ].map(s=>(
                    <div key={s.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:10, fontSize:12 }}>
                      <span style={{ color:T.sub }}>{s.label}</span>
                      <span style={{ color:s.color, fontWeight:"bold" }}>{s.value}</span>
                    </div>
                  ))}
                  {log.length > 0 && (
                    <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:10, marginTop:4 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                        <span style={{ color:T.sub }}>Fraud Rate</span>
                        <span style={{ color:"#e83a4a", fontWeight:"bold" }}>
                          {((log.filter(t=>t.score>=0.65).length/log.length)*100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:20 }}>
              <div style={{ fontSize:10, color:T.sub, letterSpacing:2, marginBottom:14 }}>DECISION THRESHOLD MAP</div>
              <div style={{ position:"relative", height:38, borderRadius:7, overflow:"hidden", display:"flex" }}>
                <div style={{ flex:35, background:"linear-gradient(90deg,#003d2a,#00c47a44)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:10, color:"#00c47a", fontFamily:"monospace" }}>AUTO APPROVE</span>
                </div>
                <div style={{ flex:30, background:"linear-gradient(90deg,#3d2a00,#e8920a44)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:10, color:"#e8920a", fontFamily:"monospace" }}>MANUAL REVIEW</span>
                </div>
                <div style={{ flex:35, background:"linear-gradient(90deg,#3d0a00,#e83a4a44)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:10, color:"#e83a4a", fontFamily:"monospace" }}>BLOCK & ALERT</span>
                </div>
                {score !== null && (
                  <div style={{ position:"absolute", top:0, bottom:0, left:`${score*100}%`,
                    width:2, background:"#fff", transition:"left 0.5s", zIndex:2 }}>
                    <div style={{ position:"absolute", top:-22, left:-22, fontSize:9,
                      color:"#fff", background:"#333", padding:"2px 6px", borderRadius:4,
                      whiteSpace:"nowrap", fontFamily:"monospace" }}>
                      {(score*100).toFixed(1)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:7, fontSize:9, color:T.muted, fontFamily:"monospace" }}>
                <span>0.0</span><span>0.35</span><span>0.65</span><span>1.0</span>
              </div>
            </div>
          </div>
        )}

        {/* LOG TAB */}
        {activeTab === "log" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:10, color:T.sub, letterSpacing:2 }}>TRANSACTION EVENT LOG</div>
              {log.length > 0 && (
                <button onClick={()=>setLog([])} style={{
                  background:"none", border:`1px solid ${T.border}`, color:T.sub,
                  fontSize:10, padding:"4px 12px", borderRadius:5, cursor:"pointer", fontFamily:"monospace"
                }}>CLEAR</button>
              )}
            </div>

            {log.length === 0 ? (
              <div style={{ textAlign:"center", padding:64, color:T.muted, fontSize:12 }}>
                No transactions logged yet.<br/>
                <span style={{ color:T.sub }}>Run analysis → send to Decision module to populate the log.</span>
              </div>
            ) : (
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, overflow:"hidden" }}>
                <div style={{ display:"flex", gap:12, padding:"9px 14px",
                  borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.muted, fontFamily:"monospace",
                  background:T.panel }}>
                  <span style={{ minWidth:28 }}>#</span>
                  <span style={{ minWidth:90 }}>MERCHANT</span>
                  <span style={{ minWidth:72 }}>AMOUNT</span>
                  <span style={{ minWidth:55 }}>TYPE</span>
                  <span style={{ minWidth:60 }}>SCORE</span>
                  <span>DECISION</span>
                </div>
                <div style={{ maxHeight:480, overflowY:"auto" }} ref={logRef}>
                  {log.map((t,i) => <LogEntry key={t.id} tx={t} idx={i} dark={dark} />)}
                </div>
              </div>
            )}

            {log.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:16 }}>
                {[
                  { label:"TOTAL",    value:log.length,                                        color:T.text    },
                  { label:"APPROVED", value:log.filter(t=>t.score<0.35).length,                color:"#00c47a" },
                  { label:"REVIEW",   value:log.filter(t=>t.score>=0.35&&t.score<0.65).length, color:"#e8920a" },
                  { label:"BLOCKED",  value:log.filter(t=>t.score>=0.65).length,               color:"#e83a4a" },
                ].map(s=>(
                  <div key={s.label} style={{ background:T.surface, border:`1px solid ${T.border}`,
                    borderRadius:8, padding:"14px 16px", textAlign:"center" }}>
                    <div style={{ fontSize:26, fontWeight:"bold", color:s.color, fontFamily:"'Bebas Neue'" }}>{s.value}</div>
                    <div style={{ fontSize:9, color:T.sub, letterSpacing:2, marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}