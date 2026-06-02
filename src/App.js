import { useState, useEffect, useCallback } from "react";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyhvl7lZtjX2h3o79Em3nCzyvn6hHxUEOo0c17B4wTv1QELtjYGjf4dJpI-R1ECuamF/exec";

const TEAM = ["DIN","PRIU","SIVP","SIVT","BALM","KAGA","RANG","PRIL","SUBA","KART","MAHE","SHAN"];

const LEAVE_TYPES = {
  FULL: { label: "Full Day",       color: "#F87171", icon: "●" },
  HALF: { label: "Half Day",       color: "#FBBF24", icon: "◐" },
  WFH:  { label: "Work From Home", color: "#60A5FA", icon: "⌂" },
};

const MEMBER_COLORS = [
  "#F87171","#FB923C","#FBBF24","#34D399","#60A5FA",
  "#A78BFA","#F472B6","#22D3EE","#86EFAC","#C084FC",
  "#FCA5A5","#6EE7B7"
];

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function toDateStr(y, m, d) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
function getDaysInMonth(y, m) { return new Date(y, m+1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function memberColor(m) { return MEMBER_COLORS[TEAM.indexOf(m) % MEMBER_COLORS.length]; }

function getLeavesForDay(leaves, y, mo, d) {
  const ds = toDateStr(y, mo, d);
  return leaves.filter(l => l.Start <= ds && l.End >= ds);
}

export default function App() {
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth());
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [tab, setTab]         = useState("calendar");
  const [selectedDay, setSelectedDay] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editLeave, setEditLeave] = useState(null);
  const [form, setForm] = useState({ Member:"DIN", Start:"", End:"", Type:"FULL" });
  const [toast, setToast] = useState("");
  const [filterMember, setFilterMember] = useState("ALL");

  // FIX: Use URL params for GET, JSON body for POST
  const loadLeaves = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getAll`);
      const json = await res.json();
      setLeaves(json.data || []);
    } catch (e) {
      setError("Could not connect. Check your internet connection.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  // FIX: Send data as URL-encoded form params so Apps Script receives them correctly
  const apiPost = useCallback(async (params) => {
    const body = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => body.append(k, v));
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    return res.json();
  }, []);

  const openAdd = () => {
    const d = toDateStr(year, month, selectedDay || now.getDate());
    setForm({ Member:"DIN", Start:d, End:d, Type:"FULL" });
    setEditLeave(null); setShowForm(true);
  };
  const openEdit = (l) => {
    setForm({ Member:l.Member, Start:l.Start, End:l.End, Type:l.Type });
    setEditLeave(l); setShowForm(true);
  };

  const saveLeave = async () => {
    if (!form.Start || !form.End) { setError("Please select start and end dates."); return; }
    if (form.End < form.Start) { setError("End date must be after start date."); return; }
    setSaving(true); setError("");
    try {
      if (editLeave) {
        await apiPost({ action:"update", id:editLeave.ID, Member:form.Member, Start:form.Start, End:form.End, Type:form.Type });
        showToast("Leave updated ✓");
      } else {
        await apiPost({ action:"add", Member:form.Member, Start:form.Start, End:form.End, Type:form.Type });
        showToast("Leave logged ✓");
      }
      await loadLeaves();
      setShowForm(false);
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  };

  const deleteLeave = async (l) => {
    if (!window.confirm(`Delete leave for ${l.Member}?`)) return;
    setSaving(true);
    try {
      await apiPost({ action:"delete", id:l.ID });
      showToast("Entry deleted");
      await loadLeaves();
      setSelectedDay(null);
    } catch { setError("Failed to delete."); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const ml = getMonthLeaves();
    const sorted = [...ml].sort((a,b) => a.Start.localeCompare(b.Start));
    const rows = [["ID","Member","Start Date","End Date","Leave Type","Logged At"]];
    sorted.forEach(l => rows.push([l.ID, l.Member, l.Start, l.End, LEAVE_TYPES[l.Type]?.label || l.Type, l.Timestamp || ""]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Leave_${MONTHS[month]}_${year}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Downloaded ✓");
  };

  const getMonthLeaves = () => {
    const ms = `${year}-${String(month+1).padStart(2,"0")}`;
    return leaves.filter(l => l.Start?.slice(0,7) === ms || l.End?.slice(0,7) === ms);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const monthLeaves = getMonthLeaves();
  const filteredMonthLeaves = filterMember === "ALL" ? monthLeaves : monthLeaves.filter(l => l.Member === filterMember);
  const todayLeaves = getLeavesForDay(leaves, now.getFullYear(), now.getMonth(), now.getDate());
  const dayLeaves   = selectedDay ? getLeavesForDay(leaves, year, month, selectedDay) : [];

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); setSelectedDay(null); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); setSelectedDay(null); };

  // Colors - darker, easier on eyes
  const C = {
    bg:       "#080C14",
    surface:  "#0E1420",
    card:     "#141B28",
    border:   "#1E2A3A",
    border2:  "#253345",
    text:     "#C8D4E3",
    muted:    "#4A5568",
    faint:    "#1A2438",
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.text,maxWidth:480,margin:"0 auto",paddingBottom:90,position:"relative",overflowX:"hidden"}}>

      {/* Header */}
      <div style={{position:"relative",zIndex:1,padding:"40px 16px 16px",background:`linear-gradient(180deg,${C.surface} 0%,transparent 100%)`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,letterSpacing:4,color:C.muted,textTransform:"uppercase",marginBottom:3}}>Team Manager</div>
            <div style={{fontSize:26,fontWeight:800,letterSpacing:-1,color:"#E2EAF4"}}>Leave Tracker</div>
          </div>
          <button onClick={loadLeaves} title="Refresh" style={{background:C.card,border:`1px solid ${C.border2}`,color:"#60A5FA",width:42,height:42,borderRadius:13,fontSize:18,cursor:"pointer"}}>↻</button>
        </div>

        {/* Today stats */}
        <div style={{background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:10,letterSpacing:2,textTransform:"uppercase"}}>
            Today — {now.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}
          </div>
          <div style={{display:"flex",gap:8}}>
            {Object.entries(LEAVE_TYPES).map(([k,v]) => {
              const count = todayLeaves.filter(l=>l.Type===k).length;
              return (
                <div key={k} style={{flex:1,background:C.bg,borderRadius:10,padding:"10px 6px",textAlign:"center",border:`1px solid ${count>0?v.color+"55":C.border}`}}>
                  <div style={{fontSize:16,color:count>0?v.color:C.muted}}>{v.icon}</div>
                  <div style={{fontSize:20,fontWeight:800,color:count>0?v.color:C.muted,lineHeight:1.2}}>{count}</div>
                  <div style={{fontSize:9,color:C.muted,marginTop:2,lineHeight:1.3}}>{v.label}</div>
                </div>
              );
            })}
          </div>
          {todayLeaves.length > 0 && (
            <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:5}}>
              {todayLeaves.map(l => (
                <div key={l.ID} style={{background:memberColor(l.Member)+"18",border:`1px solid ${memberColor(l.Member)}40`,borderRadius:7,padding:"3px 8px",fontSize:11,fontWeight:700,color:memberColor(l.Member),display:"flex",alignItems:"center",gap:4}}>
                  <span style={{color:LEAVE_TYPES[l.Type]?.color,fontSize:9}}>{LEAVE_TYPES[l.Type]?.icon}</span>{l.Member}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",margin:"0 16px 14px",background:C.card,borderRadius:13,padding:4,border:`1px solid ${C.border}`,position:"relative",zIndex:1}}>
        {[["calendar","📅","Calendar"],["list","📋","Log"],["export","📊","Export"]].map(([t,ic,lb])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:10,cursor:"pointer",background:tab===t?"linear-gradient(135deg,#2563EB,#4F46E5)":"transparent",color:tab===t?"#fff":C.muted,fontWeight:600,fontSize:12,transition:"all 0.2s"}}>{ic} {lb}</button>
        ))}
      </div>

      {error && <div style={{margin:"0 16px 12px",background:"#2D1010",border:"1px solid #7F1D1D",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#FCA5A5",position:"relative",zIndex:1}}>{error}</div>}
      {toast && <div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:"#065F46",color:"#D1FAE5",padding:"10px 20px",borderRadius:12,fontSize:13,fontWeight:600,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 8px 24px #00000066"}}>{toast}</div>}

      {loading && (
        <div style={{textAlign:"center",padding:60,color:C.muted,position:"relative",zIndex:1,fontSize:14}}>
          Loading from Google Sheet...
        </div>
      )}

      {/* ── CALENDAR TAB ── */}
      {!loading && tab==="calendar" && (
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px 10px"}}>
            <button onClick={prevMonth} style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:38,height:38,borderRadius:11,fontSize:20,cursor:"pointer"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:17,color:"#E2EAF4"}}>{MONTHS[month]} {year}</div>
              <div style={{fontSize:11,color:C.muted}}>{monthLeaves.length} entries</div>
            </div>
            <button onClick={nextMonth} style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:38,height:38,borderRadius:11,fontSize:20,cursor:"pointer"}}>›</button>
          </div>

          {/* Legend */}
          <div style={{display:"flex",justifyContent:"center",gap:14,padding:"0 16px 12px"}}>
            {Object.entries(LEAVE_TYPES).map(([k,v])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#7A8FA6"}}>
                <span style={{color:v.color,fontSize:12}}>{v.icon}</span>{v.label}
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px",marginBottom:3}}>
            {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:C.muted,padding:"2px 0",letterSpacing:1}}>{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 8px",gap:3}}>
            {Array(firstDay).fill(null).map((_,i)=><div key={"b"+i}/>)}
            {Array(daysInMonth).fill(null).map((_,i)=>{
              const day = i+1;
              const dl  = getLeavesForDay(leaves,year,month,day);
              const isToday    = day===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
              const isSelected = day===selectedDay;
              const weekend    = new Date(year,month,day).getDay()===0||new Date(year,month,day).getDay()===6;
              return (
                <div key={day} onClick={()=>setSelectedDay(day===selectedDay?null:day)} style={{
                  minHeight:62,borderRadius:10,padding:"4px 3px",cursor:"pointer",
                  background: isSelected?"#1A3A6B": isToday?"#122040": weekend? C.faint: C.card,
                  border: isSelected?"2px solid #3B82F6": isToday?"2px solid #2563EB44":"2px solid transparent",
                  transition:"all 0.15s",
                }}>
                  <div style={{
                    fontSize:11,fontWeight:isToday?800:500,
                    color:isToday?"#60A5FA":isSelected?"#93C5FD":weekend?C.muted:"#7A8FA6",
                    textAlign:"right",paddingRight:3,marginBottom:2
                  }}>{day}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:2}}>
                    {dl.slice(0,3).map(l=>(
                      <div key={l.ID} style={{
                        background:LEAVE_TYPES[l.Type]?.color+"20",
                        borderLeft:`2px solid ${LEAVE_TYPES[l.Type]?.color||"#666"}`,
                        borderRadius:"0 3px 3px 0",
                        padding:"1px 3px",display:"flex",alignItems:"center",gap:2
                      }}>
                        <span style={{fontSize:7,color:LEAVE_TYPES[l.Type]?.color}}>{LEAVE_TYPES[l.Type]?.icon}</span>
                        <span style={{fontSize:8,fontWeight:800,color:memberColor(l.Member),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.Member}</span>
                      </div>
                    ))}
                    {dl.length>3&&<div style={{fontSize:8,color:"#3B82F6",textAlign:"center",fontWeight:700}}>+{dl.length-3}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected day panel */}
          {selectedDay && (
            <div style={{margin:"14px 10px 0",background:C.card,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:14,color:"#93C5FD"}}>{MONTHS[month]} {selectedDay}</div>
                <div style={{fontSize:12,color:C.muted}}>{dayLeaves.length} {dayLeaves.length===1?"person":"people"}</div>
              </div>
              {dayLeaves.length===0 && <div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"10px 0"}}>No entries on this day 🎉</div>}
              {dayLeaves.map(l=>(
                <div key={l.ID} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.bg,borderRadius:11,padding:"10px 12px",marginBottom:8,border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:9,background:memberColor(l.Member)+"25",border:`2px solid ${memberColor(l.Member)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:memberColor(l.Member)}}>{l.Member}</div>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:C.text}}>{l.Member}</div>
                      <div style={{fontSize:11,color:LEAVE_TYPES[l.Type]?.color,display:"flex",alignItems:"center",gap:3,marginTop:1}}>{LEAVE_TYPES[l.Type]?.icon} {LEAVE_TYPES[l.Type]?.label}</div>
                      <div style={{fontSize:10,color:C.muted,marginTop:1}}>{l.Start===l.End?l.Start:`${l.Start} → ${l.End}`}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>openEdit(l)} style={{background:"#0F2040",border:"none",color:"#60A5FA",padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>deleteLeave(l)} style={{background:"#2D1010",border:"none",color:"#FCA5A5",padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LIST TAB ── */}
      {!loading && tab==="list" && (
        <div style={{padding:"0 10px",position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button onClick={prevMonth} style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:36,height:36,borderRadius:10,fontSize:18,cursor:"pointer"}}>‹</button>
            <div style={{fontWeight:700,fontSize:15,color:"#E2EAF4"}}>{MONTHS[month]} {year}</div>
            <button onClick={nextMonth} style={{background:C.card,border:`1px solid ${C.border}`,color:C.text,width:36,height:36,borderRadius:10,fontSize:18,cursor:"pointer"}}>›</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
            {["ALL",...TEAM].map(m=>(
              <button key={m} onClick={()=>setFilterMember(m)} style={{padding:"4px 9px",borderRadius:8,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:filterMember===m?(m==="ALL"?"#2563EB":memberColor(m)):C.card,color:filterMember===m?"#fff":C.muted}}>{m}</button>
            ))}
          </div>
          {filteredMonthLeaves.length===0 && <div style={{color:C.muted,textAlign:"center",padding:40,fontSize:14}}>No entries for this month</div>}
          {[...filteredMonthLeaves].sort((a,b)=>a.Start?.localeCompare(b.Start)).map(l=>(
            <div key={l.ID} style={{background:C.card,borderRadius:13,padding:"12px 14px",marginBottom:9,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:memberColor(l.Member)+"25",border:`2px solid ${memberColor(l.Member)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:memberColor(l.Member)}}>{l.Member}</div>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:C.text}}>{l.Member}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{l.Start===l.End?l.Start:`${l.Start} → ${l.End}`}</div>
                  <div style={{fontSize:11,color:LEAVE_TYPES[l.Type]?.color,marginTop:2,display:"flex",alignItems:"center",gap:3}}>{LEAVE_TYPES[l.Type]?.icon} {LEAVE_TYPES[l.Type]?.label}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>openEdit(l)} style={{background:"#0F2040",border:"none",color:"#60A5FA",padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>deleteLeave(l)} style={{background:"#2D1010",border:"none",color:"#FCA5A5",padding:"6px 10px",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EXPORT TAB ── */}
      {!loading && tab==="export" && (
        <div style={{padding:"0 14px",position:"relative",zIndex:1}}>
          <div style={{background:C.card,borderRadius:14,padding:18,border:`1px solid ${C.border}`,marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:3,color:"#E2EAF4"}}>{MONTHS[month]} {year} Summary</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:14}}>{monthLeaves.length} total entries</div>
            {TEAM.filter(m=>monthLeaves.some(l=>l.Member===m)).map(m=>{
              const ml=monthLeaves.filter(l=>l.Member===m);
              return (
                <div key={m} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:28,height:28,borderRadius:7,background:memberColor(m)+"25",border:`2px solid ${memberColor(m)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:memberColor(m)}}>{m}</div>
                    <span style={{fontSize:13,fontWeight:600,color:C.text}}>{m}</span>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {Object.entries(LEAVE_TYPES).map(([k,v])=>{
                      const c=ml.filter(l=>l.Type===k).length;
                      return c>0?<div key={k} style={{fontSize:11,color:v.color,background:v.color+"18",borderRadius:6,padding:"2px 8px",fontWeight:700}}>{v.icon} {c}</div>:null;
                    })}
                  </div>
                </div>
              );
            })}
            {monthLeaves.length===0&&<div style={{color:C.muted,textAlign:"center",padding:16,fontSize:13}}>No leaves this month</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,background:C.card,borderRadius:12,padding:"10px 14px",border:`1px solid ${C.border}`}}>
            <button onClick={prevMonth} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,width:32,height:32,borderRadius:8,fontSize:17,cursor:"pointer"}}>‹</button>
            <span style={{fontWeight:600,fontSize:14,color:"#E2EAF4"}}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.text,width:32,height:32,borderRadius:8,fontSize:17,cursor:"pointer"}}>›</button>
          </div>
          <button onClick={exportCSV} style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#065F46,#047857)",border:"none",borderRadius:13,color:"#D1FAE5",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            📥 Download as Excel / CSV
          </button>
          <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:7}}>Opens in Microsoft Excel or Google Sheets</div>
        </div>
      )}

      {/* FAB */}
      <button onClick={openAdd} style={{position:"fixed",bottom:24,right:20,width:56,height:56,borderRadius:17,background:"linear-gradient(135deg,#2563EB,#4F46E5)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",boxShadow:"0 8px 28px #2563EB55",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>+</button>

      {/* Form Modal */}
      {showForm && (
        <div style={{position:"fixed",inset:0,background:"#00000088",display:"flex",alignItems:"flex-end",zIndex:100}} onClick={e=>{if(e.target===e.currentTarget)setShowForm(false)}}>
          <div style={{background:C.surface,borderRadius:"20px 20px 0 0",padding:"18px 18px 44px",width:"100%",maxWidth:480,margin:"0 auto",border:`1px solid ${C.border2}`,borderBottom:"none"}}>
            <div style={{width:36,height:4,background:C.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:"#E2EAF4"}}>{editLeave?"✏️ Edit Leave":"➕ Log Leave"}</div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:7,letterSpacing:1,textTransform:"uppercase"}}>Team Member</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {TEAM.map(m=>(
                  <button key={m} onClick={()=>setForm(f=>({...f,Member:m}))} style={{padding:"6px 10px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:form.Member===m?memberColor(m)+"40":C.card,color:form.Member===m?memberColor(m):C.muted,outline:form.Member===m?`2px solid ${memberColor(m)}`:"none"}}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:7,letterSpacing:1,textTransform:"uppercase"}}>Leave Type</div>
              <div style={{display:"flex",gap:7}}>
                {Object.entries(LEAVE_TYPES).map(([k,v])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,Type:k}))} style={{flex:1,padding:"10px 4px",borderRadius:11,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:form.Type===k?v.color+"30":C.card,color:form.Type===k?v.color:C.muted,outline:form.Type===k?`2px solid ${v.color}`:"none"}}>{v.icon}<br/><span style={{fontSize:10}}>{v.label}</span></button>
                ))}
              </div>
            </div>

            <div style={{display:"flex",gap:10,marginBottom:18}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:5,letterSpacing:1,textTransform:"uppercase"}}>Start Date</div>
                <input type="date" value={form.Start} onChange={e=>setForm(f=>({...f,Start:e.target.value}))} style={{width:"100%",background:C.bg,border:`1px solid ${C.border2}`,borderRadius:10,padding:"11px 10px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:5,letterSpacing:1,textTransform:"uppercase"}}>End Date</div>
                <input type="date" value={form.End} onChange={e=>setForm(f=>({...f,End:e.target.value}))} style={{width:"100%",background:C.bg,border:`1px solid ${C.border2}`,borderRadius:10,padding:"11px 10px",color:C.text,fontSize:13,boxSizing:"border-box"}}/>
              </div>
            </div>

            {error&&<div style={{background:"#2D1010",border:"1px solid #7F1D1D",borderRadius:9,padding:"8px 12px",fontSize:12,color:"#FCA5A5",marginBottom:12}}>{error}</div>}

            <button onClick={saveLeave} disabled={saving} style={{width:"100%",padding:"14px",background:saving?C.card:"linear-gradient(135deg,#2563EB,#4F46E5)",border:"none",borderRadius:12,color:saving?C.muted:"#fff",fontWeight:800,fontSize:15,cursor:saving?"not-allowed":"pointer"}}>
              {saving?"Saving...":editLeave?"Save Changes":"Log Leave"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
