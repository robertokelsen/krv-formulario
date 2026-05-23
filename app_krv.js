// ============================================================
// KRV — Formulário de Geração de Contrato (v3)
// ============================================================

// ---- CONFIG: ajuste os webhooks ----
const WEBHOOK_GRUPO = 'https://n8n.larke.com.br/webhook/criar-grupo-paco';
const WEBHOOK_CONTRATO = 'https://n8n.larke.com.br/webhook/nova-venda-paco';
const WEBHOOK_IA = 'https://n8n.larke.com.br/webhook/revisar-ia'; // opcional

// ---- CONFIG DOS EMPREENDIMENTOS ----
const EMPREENDIMENTOS = {
  paco_aguas: {
    nome: "Paço das Águas", matricula: "5480", previsao_entrega: "dezembro de 2027",
    blocos: ["A","B","C","D","E"], pavimentos: 4, unidades_por_pavimento: 8,
    tres_quartos: [1,4,5,8], prefixo_grupo: "PACO AGUAS"
  },
  gran_royal: {
    nome: "Gran Royal", matricula: "31228", previsao_entrega: "dezembro de 2026",
    blocos: ["A","B"], pavimentos: 5, unidades_por_pavimento: 12,
    tres_quartos: [1,6,7,12], prefixo_grupo: "GRAN ROYAL"
  }
};
const TIPOLOGIAS = {
  '3q': { nome:"3 quartos", area:"64,60 m²",
    desc:"APARTAMENTO 3 QUARTOS: 64,60m² de área construída, constituído de 01 (uma) suíte, 02 (dois) quartos, 01 (um) banheiro social, sala, cozinha, varanda e 01 (uma) vaga para veículo." },
  '2q': { nome:"2 quartos", area:"57,94 m²",
    desc:"APARTAMENTO 2 QUARTOS: 57,94m² de área construída, constituído de 01 (uma) suíte, 01 (um) quarto, 01 (um) banheiro social, sala, cozinha, varanda e 01 (uma) vaga para veículo." }
};

const venda = { groupJid:null, nome_grupo:null, emp:null };

// ---- HELPERS ----
function parseBRL(v){ if(!v)return 0; let s=String(v).replace(/[^\d,.\-]/g,''); const tv=s.includes(','),tp=s.includes('.'); if(tv&&tp)s=s.replace(/\./g,'').replace(',','.'); else if(tv)s=s.replace(',','.'); const n=parseFloat(s); return isFinite(n)?n:0; }
function fmtBRL(n){ return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function validarCPF(cpf){ cpf=String(cpf).replace(/[^\d]/g,''); if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false; let s=0,r; for(let i=1;i<=9;i++)s+=parseInt(cpf.substring(i-1,i))*(11-i); r=(s*10)%11; if(r===10||r===11)r=0; if(r!==parseInt(cpf.substring(9,10)))return false; s=0; for(let i=1;i<=10;i++)s+=parseInt(cpf.substring(i-1,i))*(12-i); r=(s*10)%11; if(r===10||r===11)r=0; return r===parseInt(cpf.substring(10,11)); }
function validarTel(t){ const d=String(t).replace(/\D/g,''); return d.length===10||d.length===11; }
function validarEmail(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function telLimpo(t){ const d=String(t).replace(/\D/g,''); return d.startsWith('55')?d:'55'+d; }
function maskCPFval(v){ v=v.replace(/\D/g,'').slice(0,11); return v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2'); }
function maskTelVal(v){ v=v.replace(/\D/g,'').slice(0,11); if(v.length>6)v=v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3'); else if(v.length>2)v=v.replace(/(\d{2})(\d{0,5})/,'($1) $2'); return v.trim(); }

// PRICE
function calcPRICE(vf, taxaPct, n){ const i=taxaPct/100; if(i<=0)return vf/n; const f=Math.pow(1+i,n); return vf*(i*f)/(f-1); }

function tipologiaDe(emp, unidade){
  const cfg = EMPREENDIMENTOS[emp]; if(!cfg) return null;
  const u = String(unidade); const ult = parseInt(u.slice(-2));
  return cfg.tres_quartos.includes(ult) ? '3q' : '2q';
}

// ---- POPULAR BLOCO/UNIDADE conforme empreendimento ----
const selEmp = document.getElementById('empreendimento');
const selBloco = document.getElementById('bloco');
const selUnidade = document.getElementById('unidade_numero');

selEmp.addEventListener('change', () => {
  const emp = selEmp.value;
  venda.emp = emp;
  selBloco.innerHTML = '<option value="">—</option>';
  selUnidade.innerHTML = '<option value="">—</option>';
  document.getElementById('empInfo').classList.remove('show');
  document.getElementById('tipoBadge').classList.remove('show');
  if(!emp) return;
  const cfg = EMPREENDIMENTOS[emp];
  cfg.blocos.forEach(b => { const o=document.createElement('option'); o.value=b; o.textContent='Bloco '+b; selBloco.appendChild(o); });
  document.getElementById('brandSub').textContent = 'Geração de Contrato — ' + cfg.nome;
  const info = document.getElementById('empInfo');
  info.innerHTML = `<b>${cfg.nome}</b> — matrícula ${cfg.matricula}, entrega ${cfg.previsao_entrega}. ${cfg.blocos.length} blocos × ${cfg.pavimentos} pav × ${cfg.unidades_por_pavimento} un.`;
  info.classList.add('show');
});

selBloco.addEventListener('change', () => {
  const emp = selEmp.value; if(!emp) return;
  const cfg = EMPREENDIMENTOS[emp];
  selUnidade.innerHTML = '<option value="">—</option>';
  for(let pav=1; pav<=cfg.pavimentos; pav++){
    for(let u=1; u<=cfg.unidades_por_pavimento; u++){
      const num = pav + (u<10 ? '0'+u : ''+u);
      const o=document.createElement('option'); o.value=num; o.textContent=num; selUnidade.appendChild(o);
    }
  }
});

selUnidade.addEventListener('change', () => {
  const emp = selEmp.value; const t = tipologiaDe(emp, selUnidade.value);
  const b = document.getElementById('tipoBadge');
  if(t){ b.innerHTML=`Unidade <b>${TIPOLOGIAS[t].nome}</b> (${TIPOLOGIAS[t].area}).`; b.classList.add('show'); }
  else b.classList.remove('show');
});

// ---- COMPRADORES (ilimitados) ----
let compradorCount = 0;
const compradoresContainer = document.getElementById('compradoresContainer');

function criarComprador(primeiro=false){
  compradorCount++;
  const idx = compradorCount;
  const div = document.createElement('div');
  div.className = 'sub-card';
  div.dataset.comprador = idx;
  div.innerHTML = `
    <div class="sub-card-head">
      <h4>Comprador ${idx}</h4>
      ${primeiro ? '' : '<button type="button" class="btn-danger btn-sm" onclick="removerComprador('+idx+')">Remover</button>'}
    </div>
    <div class="sub-grid">
      <div class="field full"><label>Nome completo <span class="req">*</span></label><input type="text" data-f="nome" required></div>
      <div class="field"><label>CPF <span class="req">*</span></label><input type="text" data-f="cpf" class="mask-cpf" placeholder="000.000.000-00" required></div>
      <div class="field"><label>Nacionalidade</label><select data-f="nacionalidade"><option value="brasileiro(a)">brasileiro(a)</option><option value="estrangeiro(a)">estrangeiro(a)</option></select></div>
      <div class="field"><label>Estado civil <span class="req">*</span></label><select data-f="estado_civil" required><option value="">—</option><option>solteiro(a)</option><option>casado(a)</option><option>divorciado(a)</option><option>viúvo(a)</option><option>união estável</option></select></div>
      <div class="field"><label>Profissão <span class="req">*</span></label><input type="text" data-f="profissao" required></div>
      <div class="field"><label>WhatsApp <span class="req">*</span> <span class="hint">(recebe link)</span></label><input type="text" data-f="whatsapp" class="mask-tel" placeholder="(85) 99999-9999" required></div>
      <div class="field"><label>E-mail <span class="req">*</span> <span class="hint">(cadastro D4Sign)</span></label><input type="email" data-f="email" required></div>
      ${primeiro ? '' : '<div class="field full checkrow"><input type="checkbox" data-f="mesmo_end" id="mesmoEnd'+idx+'"><label for="mesmoEnd'+idx+'" style="font-weight:400;">Mesmo endereço do Comprador 1</label></div>'}
      <div class="field full" data-end-wrap>
        <div class="sub-grid">
          <div class="field"><label>CEP <span class="req">*</span></label><input type="text" data-f="cep" class="mask-cep" placeholder="00000-000" required><span class="hint" data-cep-status></span></div>
          <div class="field"><label>Número <span class="req">*</span></label><input type="text" data-f="numero" placeholder="nº" required></div>
          <div class="field full"><label>Rua <span class="req">*</span></label><input type="text" data-f="rua" required></div>
          <div class="field"><label>Bairro <span class="req">*</span></label><input type="text" data-f="bairro" required></div>
          <div class="field"><label>Cidade/UF <span class="req">*</span></label><input type="text" data-f="cidade" required></div>
          <div class="field full"><label>Complemento <span class="hint">(opcional)</span></label><input type="text" data-f="complemento" placeholder="apto, bloco, ponto de referência"></div>
        </div>
      </div>`;
  compradoresContainer.appendChild(div);

  // máscaras
  div.querySelector('.mask-cpf').addEventListener('input', e => e.target.value = maskCPFval(e.target.value));
  div.querySelector('.mask-tel').addEventListener('input', e => e.target.value = maskTelVal(e.target.value));

  // ---- CEP: máscara + autopreenchimento via ViaCEP ----
  const cepInput = div.querySelector('.mask-cep');
  const cepStatus = div.querySelector('[data-cep-status]');
  cepInput.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g,'').slice(0,8);
    if(v.length>5) v = v.slice(0,5)+'-'+v.slice(5);
    e.target.value = v;
    if(v.replace(/\D/g,'').length === 8) buscarCEP(div, v, cepStatus);
  });

  // checkbox mesmo endereço
  const chk = div.querySelector('[data-f="mesmo_end"]');
  if(chk){
    chk.addEventListener('change', () => {
      const endWrap = div.querySelector('[data-end-wrap]');
      if(chk.checked){
        const c1 = compradoresContainer.querySelector('[data-comprador="1"]');
        ['cep','numero','rua','bairro','cidade','complemento'].forEach(f=>{
          const orig = c1.querySelector(`[data-f="${f}"]`);
          const dest = div.querySelector(`[data-f="${f}"]`);
          if(orig && dest) dest.value = orig.value;
        });
        endWrap.style.display='none';
      } else { endWrap.style.display='block'; }
    });
  }
}

// ---- Busca CEP via ViaCEP e autopreenche ----
async function buscarCEP(div, cep, statusEl){
  const limpo = cep.replace(/\D/g,'');
  if(limpo.length !== 8) return;
  if(statusEl) statusEl.textContent = 'buscando…';
  try{
    const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    const d = await resp.json();
    if(d.erro){
      if(statusEl) statusEl.textContent = 'CEP não encontrado';
      return;
    }
    const setF = (f,v)=>{ const el=div.querySelector(`[data-f="${f}"]`); if(el && v) el.value = v; };
    setF('rua', d.logradouro);
    setF('bairro', d.bairro);
    setF('cidade', d.localidade && d.uf ? `${d.localidade}/${d.uf}` : '');
    if(statusEl) statusEl.textContent = '✓';
    // foca no número, que é o que falta digitar
    const numEl = div.querySelector('[data-f="numero"]');
    if(numEl) numEl.focus();
  }catch(e){
    if(statusEl) statusEl.textContent = 'erro ao buscar';
  }
}
window.removerComprador = function(idx){
  const el = compradoresContainer.querySelector(`[data-comprador="${idx}"]`);
  if(el) el.remove();
};
document.getElementById('addComprador').addEventListener('click', () => criarComprador(false));
criarComprador(true); // primeiro comprador

// ---- TOGGLES de pagamento ----
document.querySelectorAll('.pay-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('on');
    const sec = document.getElementById('sec_'+chip.dataset.comp);
    sec.classList.toggle('show', chip.classList.contains('on'));
    atualizarCalc();
  });
});

// sinal parcelado mostra qtd
document.getElementById('sinal_forma').addEventListener('change', e => {
  document.getElementById('sinal_parc_qtd_wrap').style.display = e.target.value==='parcelado' ? 'flex' : 'none';
});

// ---- BALÕES ----
let balaoCount = 0;
const baloesContainer = document.getElementById('baloesContainer');
function criarBalao(){
  balaoCount++; const idx=balaoCount;
  const div=document.createElement('div'); div.className='sub-card'; div.dataset.balao=idx;
  div.innerHTML=`<div class="sub-card-head"><h4>Balão ${idx}</h4><button type="button" class="btn-danger btn-sm" onclick="removerBalao(${idx})">Remover</button></div>
    <div class="sub-grid">
      <div class="field"><label>Valor</label><input type="text" data-f="valor" class="balao-val" placeholder="10.000,00" inputmode="decimal"></div>
      <div class="field"><label>Data / vencimento</label><input type="text" data-f="data" placeholder="dez/2026 ou anual"></div>
    </div>`;
  baloesContainer.appendChild(div);
  div.querySelector('.balao-val').addEventListener('input', atualizarCalc);
}
window.removerBalao = function(idx){ const el=baloesContainer.querySelector(`[data-balao="${idx}"]`); if(el){el.remove(); atualizarCalc();} };
document.getElementById('addBalao').addEventListener('click', criarBalao);

// ---- PRICE em tempo real ----
function atualizarPrice(){
  const vf = parseBRL(document.getElementById('valor_parcelamento').value);
  const n = parseInt(document.getElementById('qtd_parcelas').value);
  const taxa = parseBRL(document.getElementById('taxa_mensal').value);
  const manual = parseBRL(document.getElementById('valor_parcela_manual').value);
  const box = document.getElementById('priceResult');
  if(!vf || !n){ box.style.display='none'; return; }
  box.style.display='block';
  let pmt, nota='';
  if(manual > 0){ pmt = manual; nota = '(parcela informada manualmente)'; }
  else { pmt = calcPRICE(vf, taxa, n); nota = `@ ${taxa}% a.m.`; }
  const total = pmt * n;
  document.getElementById('pricePmt').textContent = fmtBRL(pmt);
  document.getElementById('priceTotal').textContent = fmtBRL(total);
  document.getElementById('priceJuros').textContent = fmtBRL(total - vf);
  document.getElementById('priceManualNote').textContent = nota;
}
['valor_parcelamento','qtd_parcelas','taxa_mensal','valor_parcela_manual'].forEach(id =>
  document.getElementById(id).addEventListener('input', () => { atualizarPrice(); atualizarCalc(); }));

// ---- CÁLCULO DA SOMA (valor de face) ----
function somaComponentes(){
  let soma = 0;
  if(document.querySelector('.pay-chip[data-comp="sinal"]').classList.contains('on')) soma += parseBRL(document.getElementById('valor_sinal').value);
  if(document.querySelector('.pay-chip[data-comp="parcelamento"]').classList.contains('on')) soma += parseBRL(document.getElementById('valor_parcelamento').value);
  if(document.querySelector('.pay-chip[data-comp="poschave"]').classList.contains('on')) soma += parseBRL(document.getElementById('valor_poschave').value);
  if(document.querySelector('.pay-chip[data-comp="banco"]').classList.contains('on')) soma += parseBRL(document.getElementById('saldo_devedor').value);
  if(document.querySelector('.pay-chip[data-comp="baloes"]').classList.contains('on')){
    baloesContainer.querySelectorAll('.balao-val').forEach(i => soma += parseBRL(i.value));
  }
  return soma;
}
function atualizarCalc(){
  const total = parseBRL(document.getElementById('valor_total').value);
  const soma = somaComponentes();
  const box=document.getElementById('calcBox'), val=document.getElementById('calcVal');
  if(!total && !soma){ val.textContent='—'; box.className='calc-box'; return; }
  val.textContent = fmtBRL(soma)+' / '+fmtBRL(total);
  box.className = (Math.abs(total-soma)<=1 && total>0) ? 'calc-box good' : 'calc-box bad';
}
['valor_total','valor_sinal','valor_poschave','saldo_devedor'].forEach(id =>
  document.getElementById(id).addEventListener('input', atualizarCalc));

// ---- VALIDAÇÃO ----
function setErr(el,msg){ el.classList.add('invalid'); el.classList.remove('valid'); const e=el.parentElement.querySelector('.field-err'); if(e){e.textContent=msg;e.classList.add('show');} }
function clearErr(el){ el.classList.remove('invalid'); el.classList.add('valid'); const e=el.parentElement.querySelector('.field-err'); if(e)e.classList.remove('show'); }

// ---- IA: revisar particularidades ----
document.getElementById('revisarIA').addEventListener('click', async () => {
  const obs = document.getElementById('observacoes').value.trim();
  const box = document.getElementById('iaResult');
  if(!obs){ box.className='ia-result show'; box.innerHTML='<h5>Sem texto</h5>Escreva as particularidades antes de revisar.'; return; }
  box.className='ia-result show'; box.innerHTML='<h5>Analisando…</h5>Revisando a negociação com IA.';
  // Monta contexto dos valores atuais
  const ctx = {
    observacoes: obs,
    valor_total: document.getElementById('valor_total').value,
    soma_componentes: fmtBRL(somaComponentes()),
    tem_sinal: document.querySelector('.pay-chip[data-comp="sinal"]').classList.contains('on'),
    tem_parcelamento: document.querySelector('.pay-chip[data-comp="parcelamento"]').classList.contains('on'),
    tem_baloes: document.querySelector('.pay-chip[data-comp="baloes"]').classList.contains('on'),
    tem_poschave: document.querySelector('.pay-chip[data-comp="poschave"]').classList.contains('on'),
    tem_banco: document.querySelector('.pay-chip[data-comp="banco"]').classList.contains('on')
  };
  try{
    const resp = await fetch(WEBHOOK_IA, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(ctx) });
    if(resp.ok){
      const data = await resp.json().catch(()=>({}));
      const texto = data.analise || data.text || data.resposta || JSON.stringify(data);
      box.innerHTML = '<h5>🤖 Análise da IA</h5>' + texto.replace(/\n/g,'<br>');
    } else {
      box.innerHTML = '<h5>IA indisponível</h5>O webhook de IA ainda não está configurado. O campo de observações será enviado normalmente no contrato.';
    }
  }catch(e){
    box.innerHTML = '<h5>IA indisponível</h5>Não foi possível conectar à IA agora. O texto de observações será enviado mesmo assim.';
  }
});

// ---- MODAL ----
function showModal(html){ document.getElementById('modal').innerHTML=html; document.getElementById('overlay').classList.add('show'); }
function hideModal(){ document.getElementById('overlay').classList.remove('show'); }

// ---- ETAPA 1 → cria grupo ----
const etapa1 = ['empreendimento','corretor_nome','corretor_whatsapp','corretor_email','bloco','unidade_numero','cliente_nome_grupo'];
document.getElementById('createGroupBtn').addEventListener('click', async () => {
  let ok=true;
  etapa1.forEach(id=>{ const el=document.getElementById(id); const v=el.value.trim();
    if(!v){ setErr(el,'Obrigatório'); ok=false; }
    else if(id==='corretor_whatsapp' && !validarTel(v)){ setErr(el,'Telefone inválido'); ok=false; }
    else if(id==='corretor_email' && !validarEmail(v)){ setErr(el,'E-mail inválido'); ok=false; }
    else clearErr(el);
  });
  if(!ok) return;

  const emp = EMPREENDIMENTOS[selEmp.value];
  const bloco = selBloco.value, unidade = selUnidade.value;
  const tipo = tipologiaDe(selEmp.value, unidade);
  const clienteNome = document.getElementById('cliente_nome_grupo').value.trim();
  venda.nome_grupo = `${emp.prefixo_grupo} - BL ${bloco} UN ${unidade}${tipo?' ('+TIPOLOGIAS[tipo].nome+')':''} - ${clienteNome.split(' ')[0].toUpperCase()}`;

  const payload = {
    empreendimento: selEmp.value, nome_empreendimento: emp.nome,
    nome_grupo: venda.nome_grupo,
    corretor_nome: document.getElementById('corretor_nome').value.trim(),
    corretor_whatsapp: telLimpo(document.getElementById('corretor_whatsapp').value),
    bloco, unidade_numero: unidade, tipologia_tipo: tipo?TIPOLOGIAS[tipo].nome:''
  };

  showModal(`<div class="spin"></div><h3>Criando grupo…</h3><p>Montando o grupo no WhatsApp com o corretor e a KRV.</p>`);
  try{
    const resp = await fetch(WEBHOOK_GRUPO, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(resp.ok){
      const data = await resp.json().catch(()=>({}));
      venda.groupJid = (data.data && data.data.id) || data.groupJid || data.id || null;
      hideModal();
      document.getElementById('panel1').classList.remove('active');
      document.getElementById('panel2').classList.add('active');
      document.getElementById('pill1').classList.replace('active','done');
      document.getElementById('pill2').classList.add('active');
      document.getElementById('resumoUnidade').textContent = `${emp.nome} — Bloco ${bloco}, UN ${unidade}`;
      window.scrollTo({top:0,behavior:'smooth'});
    } else {
      const t=await resp.text();
      showModal(`<div class="icon">⚠️</div><h3>Erro ao criar grupo</h3><ul class="errlist"><li>${t.slice(0,200)}</li></ul><button class="btn-primary" onclick="document.getElementById('overlay').classList.remove('show')">Voltar</button>`);
    }
  }catch(e){
    showModal(`<div class="icon">❌</div><h3>Falha de conexão</h3><p>Não foi possível criar o grupo.</p><button class="btn-primary" onclick="document.getElementById('overlay').classList.remove('show')">Voltar</button>`);
  }
});

document.getElementById('backStep1').addEventListener('click', () => {
  document.getElementById('panel2').classList.remove('active');
  document.getElementById('panel1').classList.add('active');
  document.getElementById('pill2').classList.remove('active');
  document.getElementById('pill1').classList.replace('done','active');
  window.scrollTo({top:0,behavior:'smooth'});
});

// ---- ETAPA 2 → gera contrato ----
document.getElementById('submitBtn').addEventListener('click', async () => {
  const btnSubmit = document.getElementById('submitBtn');
  // PROTEÇÃO ANTI-DUPLICAÇÃO: se já está enviando, ignora cliques extras
  if (btnSubmit.dataset.enviando === '1') return;

  const erros = [];

  // valida compradores
  const compradores = [];
  compradoresContainer.querySelectorAll('.sub-card').forEach((card, i) => {
    const get = f => { const el=card.querySelector(`[data-f="${f}"]`); return el?el.value.trim():''; };
    // monta endereço completo a partir dos campos
    const rua = get('rua'), numero = get('numero'), bairro = get('bairro'),
          cidade = get('cidade'), cep = get('cep'), complemento = get('complemento');
    let endereco = rua;
    if(numero) endereco += ', nº ' + numero;
    if(complemento) endereco += ', ' + complemento;
    if(bairro) endereco += ', ' + bairro;
    if(cidade) endereco += ', ' + cidade;
    if(cep) endereco += ', CEP ' + cep;

    const c = {
      nome: get('nome'), cpf: get('cpf'), nacionalidade: get('nacionalidade'),
      estado_civil: get('estado_civil'), profissao: get('profissao'),
      whatsapp: get('whatsapp'), email: get('email'),
      endereco: endereco,
      // também envia os campos separados, caso o contrato queira usar
      cep, rua, numero, bairro, cidade, complemento
    };
    // valida campos
    if(!c.nome) erros.push(`Comprador ${i+1}: nome obrigatório`);
    if(!validarCPF(c.cpf)) erros.push(`Comprador ${i+1}: CPF inválido`);
    if(!c.estado_civil) erros.push(`Comprador ${i+1}: estado civil obrigatório`);
    if(!c.profissao) erros.push(`Comprador ${i+1}: profissão obrigatória`);
    if(!validarTel(c.whatsapp)) erros.push(`Comprador ${i+1}: WhatsApp inválido`);
    if(!validarEmail(c.email)) erros.push(`Comprador ${i+1}: e-mail inválido`);
    if(!cep) erros.push(`Comprador ${i+1}: CEP obrigatório`);
    if(!rua) erros.push(`Comprador ${i+1}: rua obrigatória (preencha o CEP)`);
    if(!numero) erros.push(`Comprador ${i+1}: número obrigatório`);
    compradores.push(c);
  });
  if(compradores.length === 0) erros.push('Adicione ao menos 1 comprador');

  // valida pagamento
  const total = parseBRL(document.getElementById('valor_total').value);
  if(!total) erros.push('Valor total obrigatório');
  const dv = parseInt(document.getElementById('dia_vencimento').value);
  if(!dv || dv<1 || dv>28) erros.push('Dia de vencimento entre 1 e 28');
  const soma = somaComponentes();
  if(Math.abs(total - soma) > 1) erros.push(`Soma dos componentes (${fmtBRL(soma)}) não bate com o total (${fmtBRL(total)})`);

  if(erros.length){
    showModal(`<div class="icon">⚠️</div><h3>Revise os dados</h3><ul class="errlist">${erros.map(e=>'<li>'+e+'</li>').join('')}</ul><button class="btn-primary" onclick="document.getElementById('overlay').classList.remove('show')">Entendi</button>`);
    return;
  }

  // monta componentes de pagamento
  const on = c => document.querySelector(`.pay-chip[data-comp="${c}"]`).classList.contains('on');
  const baloes = [];
  if(on('baloes')) baloesContainer.querySelectorAll('.sub-card').forEach(b => {
    baloes.push({ valor: b.querySelector('[data-f="valor"]').value.trim(), data: b.querySelector('[data-f="data"]').value.trim() });
  });

  const pagamento = {
    valor_total: document.getElementById('valor_total').value.trim(),
    dia_vencimento: String(dv),
    sinal: on('sinal') ? { valor: document.getElementById('valor_sinal').value.trim(), forma: document.getElementById('sinal_forma').value, parcelas: document.getElementById('sinal_parcelas').value.trim() } : null,
    parcelamento: on('parcelamento') ? { valor: document.getElementById('valor_parcelamento').value.trim(), qtd: document.getElementById('qtd_parcelas').value.trim(), taxa: document.getElementById('taxa_mensal').value.trim(), parcela_manual: document.getElementById('valor_parcela_manual').value.trim() } : null,
    baloes: baloes.length ? baloes : null,
    poschave: on('poschave') ? document.getElementById('valor_poschave').value.trim() : null,
    saldo_devedor: on('banco') ? document.getElementById('saldo_devedor').value.trim() : null
  };

  const payload = {
    empreendimento: selEmp.value,
    bloco: selBloco.value, unidade_numero: selUnidade.value,
    corretor_nome: document.getElementById('corretor_nome').value.trim(),
    corretor_whatsapp: telLimpo(document.getElementById('corretor_whatsapp').value),
    corretor_email: document.getElementById('corretor_email').value.trim(),
    compradores: compradores,
    pagamento: pagamento,
    observacoes: document.getElementById('observacoes').value.trim(),
    nome_grupo: venda.nome_grupo,
    group_jid: venda.groupJid,
    origem: 'site-krv', timestamp: new Date().toISOString()
  };

  // trava o botão a partir daqui (já passou nas validações)
  btnSubmit.dataset.enviando = '1';
  btnSubmit.disabled = true;

  showModal(`<div class="spin"></div><h3>Gerando contrato…</h3><p>Criando documento, enviando ao D4Sign e disparando os links no WhatsApp.</p>`);
  try{
    const resp = await fetch(WEBHOOK_CONTRATO, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(resp.ok){
      showModal(`<div class="icon">✅</div><h3>Contrato enviado!</h3><p>Documento gerado e enviado ao D4Sign. Os compradores e o corretor receberam o link de assinatura no WhatsApp e no e-mail.</p><button class="btn-primary" onclick="location.reload()">Nova venda</button>`);
      // mantém travado — usuário recarrega para nova venda
    } else {
      const t=await resp.text();
      showModal(`<div class="icon">⚠️</div><h3>Erro no envio</h3><ul class="errlist"><li>${t.slice(0,250)}</li></ul><button class="btn-primary" onclick="document.getElementById('overlay').classList.remove('show')">Voltar</button>`);
      btnSubmit.dataset.enviando = '0'; btnSubmit.disabled = false; // libera para tentar de novo
    }
  }catch(e){
    showModal(`<div class="icon">❌</div><h3>Falha de conexão</h3><p>Não foi possível contatar o servidor.</p><button class="btn-primary" onclick="document.getElementById('overlay').classList.remove('show')">Voltar</button>`);
    btnSubmit.dataset.enviando = '0'; btnSubmit.disabled = false; // libera para tentar de novo
  }
});
