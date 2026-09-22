/* Vietnam administrative address selector.
 * UI only: users select Province/City -> District -> Ward and type street/address detail.
 * Coordinates remain an internal concern of Logistics/Maps and are never required here.
 */
(function(){
  const API='https://provinces.open-api.vn/api/v1/?depth=3';
  const CACHE_KEY='lenam_vn_admin_divisions_v1';
  const CACHE_MS=7*24*60*60*1000;
  let mem=null;
  const FALLBACK=[
    {code:'79',name:'Thành phố Hồ Chí Minh',districts:[
      {code:'769',name:'Thành phố Thủ Đức',wards:[]},{code:'765',name:'Quận Bình Thạnh',wards:[]},{code:'764',name:'Quận Gò Vấp',wards:[]},{code:'768',name:'Quận Phú Nhuận',wards:[]},{code:'760',name:'Quận 1',wards:[]},{code:'770',name:'Quận 3',wards:[]},{code:'778',name:'Quận 7',wards:[]},{code:'766',name:'Quận Tân Bình',wards:[]},{code:'767',name:'Quận Tân Phú',wards:[]},{code:'774',name:'Quận 10',wards:[]},{code:'776',name:'Quận 8',wards:[]},{code:'773',name:'Quận 4',wards:[]},{code:'775',name:'Quận 11',wards:[]},{code:'777',name:'Quận Bình Tân',wards:[]},{code:'785',name:'Huyện Bình Chánh',wards:[]},{code:'787',name:'Huyện Củ Chi',wards:[]},{code:'784',name:'Huyện Hóc Môn',wards:[]},{code:'786',name:'Huyện Nhà Bè',wards:[]},{code:'783',name:'Huyện Cần Giờ',wards:[]}
    ]},
    {code:'74',name:'Tỉnh Bình Dương',districts:[]},
    {code:'75',name:'Tỉnh Đồng Nai',districts:[]}
  ];

  function escText(v){return String(v??'');}
  async function load(){
    if(mem) return mem;
    try{
      const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(cached?.ts && Date.now()-cached.ts<CACHE_MS && Array.isArray(cached.data) && cached.data.length){mem=cached.data;return mem;}
    }catch(_){ }
    try{
      const res=await fetch(API,{headers:{Accept:'application/json'}});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      mem=await res.json();
      try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:mem}));}catch(_){ }
      return mem;
    }catch(err){
      console.warn('[VNAddress] Dùng danh mục địa chỉ dự phòng:',err);
      mem=FALLBACK;
      return mem;
    }
  }
  function selectedName(el){return el?.value?.trim()||'';}
  function setOptions(el,items,placeholder,current=''){
    if(!el)return;
    const cur=String(current||'').trim();
    el.innerHTML=`<option value="">${placeholder}</option>`+(items||[]).map(x=>`<option value="${escText(x.name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" data-code="${x.code}" ${x.name===cur?'selected':''}>${escText(x.name)}</option>`).join('');
    if(cur && ![...el.options].some(o=>o.value===cur)){
      const opt=document.createElement('option');opt.value=cur;opt.textContent=cur;opt.selected=true;el.appendChild(opt);
    }
  }
  async function init(cfg){
    const p=document.getElementById(cfg.provinceId), d=document.getElementById(cfg.districtId), w=document.getElementById(cfg.wardId);
    if(!p||!d||!w)return;
    const initial={province:cfg.province||'',district:cfg.district||'',ward:cfg.ward||''};
    const fail=()=>{
      // Keep existing/current values usable even when the public address directory is unavailable.
      [p,d,w].forEach((el,i)=>{el.disabled=false;if(!el.options.length){const labels=['-- Chọn Tỉnh/Thành phố --','-- Chọn Quận/Huyện --','-- Chọn Phường/Xã --'];el.innerHTML=`<option value="">${labels[i]}</option>`;}});
      const note=document.getElementById(cfg.noteId||'');if(note)note.textContent='Không tải được danh mục địa giới. Bạn vẫn có thể nhập đầy đủ địa chỉ chi tiết và lưu đơn.';
    };
    try{
      p.disabled=d.disabled=w.disabled=true;
      const provinces=await load();
      setOptions(p,provinces,'-- Chọn Tỉnh/Thành phố --',initial.province);
      const province=provinces.find(x=>x.name===selectedName(p));
      setOptions(d,province?.districts||[],'-- Chọn Quận/Huyện --',initial.district);
      const district=(province?.districts||[]).find(x=>x.name===selectedName(d));
      setOptions(w,district?.wards||[],'-- Chọn Phường/Xã --',initial.ward);
      p.disabled=d.disabled=w.disabled=false;
      p.onchange=()=>{
        const pp=provinces.find(x=>x.name===selectedName(p));
        setOptions(d,pp?.districts||[],'-- Chọn Quận/Huyện --','');
        setOptions(w,[],'-- Chọn Phường/Xã --','');
      };
      d.onchange=()=>{
        const pp=provinces.find(x=>x.name===selectedName(p));
        const dd=(pp?.districts||[]).find(x=>x.name===selectedName(d));
        setOptions(w,dd?.wards||[],'-- Chọn Phường/Xã --','');
      };
    }catch(err){console.warn('[VNAddress]',err);fail();}
  }
  async function setValues(cfg){
    await init(cfg);
  }
  function compose(detail,ward,district,province){
    const parts=[detail,ward,district,province].map(x=>String(x||'').trim()).filter(Boolean);
    return [...new Set(parts)].join(', ');
  }
  function read(prefix){
    const province=document.getElementById(prefix+'Province')?.value?.trim()||'';
    const district=document.getElementById(prefix+'District')?.value?.trim()||'';
    const ward=document.getElementById(prefix+'Ward')?.value?.trim()||'';
    const detail=document.getElementById(prefix+'AddressDetail')?.value?.trim()||'';
    return {province,district,ward,addressDetail:detail,address:compose(detail,ward,district,province)};
  }
  window.VNAddress={load,init,setValues,compose,read};
})();
