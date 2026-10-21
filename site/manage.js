/* Shared record editor. Existing collection-specific forms remain available. */
(() => {
  const collections = { vault_prompts:'Prompt', vault_plugins:'ปลั๊กอิน / ธีม', vault_links:'ลิงก์ดาวน์โหลด', vault_teams:'ทีม / โปรเจกต์', vault_seo_kw:'คีย์เวิร์ด SEO', vault_seo_check:'เช็กลิสต์ SEO', vault_movies:'รายการหนัง', vault_posts:'คลังโพส', vault_collector:'Collector', vault_launchers:'เมนูลัด / AI' }
  const labels = { title:'ชื่อเรื่อง', name:'ชื่อ', cat:'หมวดหมู่', prompt:'คำสั่ง Prompt', example:'ตัวอย่าง', purpose:'วัตถุประสงค์', desc:'คำอธิบาย', type:'ประเภท', version:'เวอร์ชัน', install:'วิธีติดตั้ง', usage:'วิธีใช้งาน', changelog:'ประวัติเวอร์ชัน', link:'ลิงก์', url:'URL', note:'หมายเหตุ', notes:'บันทึก', members:'สมาชิก', word:'คีย์เวิร์ด', lang:'ภาษา', text:'รายการตรวจสอบ', done:'ทำเสร็จแล้ว', code:'Code', actor:'นักแสดง', studio:'สตูดิโอ', duration:'ระยะเวลา', tags:'แท็ก', poster:'URL ภาพปก', poster_url:'URL ภาพปก', cover_url:'URL ภาพหน้าปก', gallery_urls:'URL รูปภาพ (บรรทัดละหนึ่งลิงก์)', images:'URL Screenshot', release_date:'วันเผยแพร่', content:'เนื้อหา', metadescription:'Meta Description', focuskeyphrase:'Focus Keyphrase', categories:'หมวดหมู่', actoren:'ชื่อนักแสดง EN', videourl:'Video URL', goto:'หน้าในเมนู', color:'สีประจำเมนู' }
  const dialog = document.createElement('dialog')
  dialog.style.cssText='width:min(760px,94vw);max-height:90vh;border:1px solid var(--border);border-radius:16px;background:var(--card);color:var(--text);padding:24px;overflow:auto'
  dialog.innerHTML='<form method="dialog"><button class="btn-secondary" style="float:right;padding:6px 12px">ปิด</button></form><h2>จัดการข้อมูลในคลังร่วม</h2><p style="color:var(--muted);font-size:13px">เลือกหมวดและรายการเพื่อแก้ไข ข้อมูลที่บันทึกมีผลกับทุกคน</p><label>หมวดข้อมูล<select id="manageCollection" class="input-field"></select></label><label style="display:block;margin:12px 0">ค้นหารายการ<input id="manageSearch" class="input-field" placeholder="พิมพ์ชื่อหรือ Code"></label><select id="manageRecord" class="input-field" aria-label="เลือกรายการ"></select><form id="manageForm" style="display:grid;gap:12px;margin-top:20px"></form>'
  document.body.append(dialog)
  const $ = id => document.getElementById(id)
  for (const [key, label] of Object.entries(collections)) { const option = new Option(label,key); $('manageCollection').add(option) }
  const button = document.createElement('button')
  button.className='btn-secondary';button.textContent='จัดการ / แก้ไขข้อมูล';button.style.padding='5px 10px'
  $('cloudBar').append(button)
  let current = null
  function records(){return VaultCloud.get($('manageCollection').value,[])}
  function list(){
    const select=$('manageRecord'), query=$('manageSearch').value.toLowerCase();select.replaceChildren()
    records().filter(record=>JSON.stringify(record).toLowerCase().includes(query)).forEach(record=>select.add(new Option(record.title||record.name||record.word||record.code||record.text||'ไม่มีชื่อ',record.id)))
    edit()
  }
  function edit(){
    current=records().find(record=>record.id===$('manageRecord').value)
    const form=$('manageForm');form.replaceChildren()
    if(!current){form.textContent='ยังไม่มีรายการในหมวดนี้ เพิ่มรายการจากเมนูหลักได้';return}
    for(const [key,value] of Object.entries(current)){
      if(['id','date','createdAt','updatedAt'].includes(key) || (value && typeof value==='object'&&!Array.isArray(value)))continue
      const label=document.createElement('label');label.textContent=labels[key]||key
      let input
      if(typeof value==='boolean'){input=document.createElement('input');input.type='checkbox';input.checked=value}
      else {input=document.createElement('textarea');input.rows=String(value||'').length>160?5:2;input.className='input-field';input.value=Array.isArray(value)?value.join('\n'):value??''}
      input.name=key;input.style.display='block';label.append(input);form.append(label)
    }
    const save=document.createElement('button');save.type='submit';save.className='btn-big';save.textContent='บันทึกการแก้ไข';form.append(save)
  }
  $('manageForm').addEventListener('submit',async event=>{
    event.preventDefault();if(!current)return
    const updated=structuredClone(current)
    for(const input of event.currentTarget.elements){
      if(!input.name)continue
      updated[input.name]=input.type==='checkbox'?input.checked:Array.isArray(current[input.name])?input.value.split('\n').map(s=>s.trim()).filter(Boolean):input.value
    }
    const collection=$('manageCollection').value
    VaultCloud.set(collection,records().map(record=>record.id===current.id?updated:record))
    const save=event.currentTarget.querySelector('button');save.disabled=true;save.textContent='กำลังบันทึก…'
    await VaultCloud.flush()
    if(VaultCloud.pending){save.disabled=false;save.textContent='บันทึกไม่สำเร็จ · กดลองบันทึกอีกครั้งที่แถบสถานะ';return}
    location.reload()
  })
  button.onclick=()=>{list();dialog.showModal()}
  $('manageCollection').onchange=list;$('manageSearch').oninput=list;$('manageRecord').onchange=edit
  const backup=document.createElement('button');backup.className='btn-secondary';backup.textContent='สำรองข้อมูล JSON';backup.style.padding='5px 10px'
  backup.onclick=()=>{
    const snapshot=Object.fromEntries(Object.keys(collections).map(key=>[key,VaultCloud.get(key,[])]))
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='my-vault-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  $('cloudBar').append(backup)
  const restore=document.createElement('button');restore.className='btn-secondary';restore.textContent='นำเข้าข้อมูลสำรอง';restore.style.padding='5px 10px'
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.hidden=true
  restore.onclick=()=>fileInput.click()
  fileInput.onchange=async()=>{
    const file=fileInput.files[0];if(!file)return
    try{
      if(file.size>4*1024*1024)throw new Error('ไฟล์ต้องไม่เกิน 4 MB')
      const snapshot=JSON.parse(await file.text())
      if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw new Error('รูปแบบไฟล์สำรองไม่ถูกต้อง')
      const keys=Object.keys(snapshot)
      if(!keys.length||keys.some(key=>!collections[key]||!Array.isArray(snapshot[key])||snapshot[key].some(row=>!row||typeof row!=='object'||typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,200}$/.test(row.id))))throw new Error('กรุณาเลือกไฟล์สำรองจาก My Vault')
      if(!confirm('รวมข้อมูลสำรองเข้าคลังร่วม? รายการที่มี ID เดียวกันจะใช้ข้อมูลจากไฟล์ และมีผลกับทุกคน'))return
      for(const key of keys){
        const merged=new Map(VaultCloud.get(key,[]).map(row=>[row.id,row]))
        snapshot[key].forEach(row=>merged.set(row.id,row))
        VaultCloud.set(key,[...merged.values()])
      }
      await VaultCloud.flush()
      if(!VaultCloud.pending)location.reload()
    }catch(error){alert(error.message||'นำเข้าข้อมูลไม่สำเร็จ')}
    finally{fileInput.value=''}
  }
  $('cloudBar').append(restore,fileInput)
})()
