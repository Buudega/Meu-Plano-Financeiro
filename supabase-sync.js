(() => {
  const CONFIG = window.SUPABASE_CONFIG || {};
  const configured = CONFIG.url?.startsWith('https://') && CONFIG.anonKey && !CONFIG.anonKey.startsWith('COLE_');
  const modal = document.createElement('div');
  modal.id = 'syncGate';
  modal.innerHTML = `<div class="dialog security-card"><div class="logo">M</div><h2>Sincronizar em casal</h2><p id="syncMessage" class="small muted"></p><form id="authForm"><div class="fields"><div class="field full"><label>E-mail</label><input id="syncEmail" type="email" required autocomplete="email"></div><div class="field full"><label>Senha da conta</label><input id="syncPassword" type="password" required minlength="8" autocomplete="current-password"></div></div><div class="formactions"><button type="button" id="signUpBtn">Criar conta</button><button class="primary">Entrar</button></div></form><div id="householdPanel" hidden><p>Entre em um espaço compartilhado: crie um novo ou use um código recebido do seu parceiro.</p><div class="fields"><button id="createHome" class="primary">Criar espaço do casal</button><div class="field"><label>Código do espaço</label><input id="inviteCode" autocomplete="off"></div></div><button id="joinHome">Entrar com código</button></div><div id="sharePanel" hidden><p>Espaço compartilhado ativo. Use o mesmo código para conectar a outra conta.</p><p><b id="shareCode"></b></p><button id="copyCode">Copiar código</button> <button id="signOut">Sair</button></div><p id="syncError" class="security-error"></p><p id="syncSetup" class="small muted"></p></div>`;
  document.body.append(modal);
  const $ = id => document.getElementById(id);
  let client = null, user = null, householdId = null, timer = null, channel = null, lastRemote = '';
  function message(text) { $('syncMessage').textContent = text; }
  function error(text) { $('syncError').textContent = text || ''; }
  function showGate() { modal.style.display = 'flex'; }
  window.openSyncSettings = async () => { await refreshAuth(); showGate(); };
  function hideGate() { modal.style.display = 'none'; }
  async function refreshAuth() {
    $('authForm').hidden = !!user;
    $('householdPanel').hidden = !user || !!householdId;
    $('sharePanel').hidden = !householdId;
  }
  async function loadHousehold() {
    const { data, error: err } = await client.from('household_members').select('household_id').eq('user_id', user.id).limit(1);
    if (err) throw err;
    householdId = data?.[0]?.household_id || null;
    await refreshAuth();
    if (!householdId) { message('Conta conectada. Crie um espaço ou informe o código compartilhado.'); showGate(); return; }
    await activateHousehold();
  }
  async function activateHousehold() {
    const { data: home, error: homeErr } = await client.from('households').select('invite_code').eq('id', householdId).single();
    if (homeErr) throw homeErr;
    $('shareCode').textContent = home.invite_code;
    const { data, error: readErr } = await client.from('app_data').select('payload').eq('household_id', householdId).maybeSingle();
    if (readErr) throw readErr;
    if (data?.payload) {
      state = Object.assign({expenses:[],plans:[],goals:[],extras:[],trash:[],salary:0}, data.payload);
      localStorage.setItem('meuPlanoFinanceiro_v2', JSON.stringify(state));
      lastRemote = JSON.stringify(state);
    } else {
      const { error: writeErr } = await client.from('app_data').upsert({household_id:householdId,payload:state,updated_at:new Date().toISOString()});
      if (writeErr) throw writeErr;
      lastRemote = JSON.stringify(state);
    }
    render(); await refreshAuth(); hideGate(); subscribe();
  }
  function subscribe() {
    if (channel) client.removeChannel(channel);
    channel = client.channel('household-' + householdId).on('postgres_changes', {event:'UPDATE',schema:'public',table:'app_data',filter:'household_id=eq.'+householdId}, payload => {
      const incoming = JSON.stringify(payload.new.payload);
      if (incoming === lastRemote) return;
      lastRemote = incoming;
      state = Object.assign({expenses:[],plans:[],goals:[],extras:[],trash:[],salary:0}, payload.new.payload);
      localStorage.setItem('meuPlanoFinanceiro_v2', incoming); render();
    }).subscribe();
  }
  async function doSave() {
    if (!householdId || !client) return;
    const payload = JSON.stringify(state);
    if (payload === lastRemote) return;
    const { error: err } = await client.from('app_data').upsert({household_id:householdId,payload:JSON.parse(payload),updated_at:new Date().toISOString()});
    if (err) { toast('Salvo neste aparelho; falha ao sincronizar. Verifique a conexão.'); console.error(err); return; }
    lastRemote = payload;
  }
  const localSave = window.save;
  window.save = function() {
    localSave();
    clearTimeout(timer);
    timer = setTimeout(doSave, 500);
  };
  $('authForm').onsubmit = async e => {
    e.preventDefault(); error('');
    try {
      const {data, error:err} = await client.auth.signInWithPassword({email:$('syncEmail').value,password:$('syncPassword').value});
      if (err) throw err;
      user = data.user; await loadHousehold();
    } catch (err) { error('Não foi possível entrar. Confira e-mail e senha.'); }
  };
  $('signUpBtn').onclick = async () => {
    error('');
    try {
      const {data, error:err} = await client.auth.signUp({email:$('syncEmail').value,password:$('syncPassword').value});
      if (err) throw err;
      if (data.session) { user=data.user; await loadHousehold(); }
      else message('Conta criada. Confirme o e-mail e depois entre no app.');
    } catch (err) { error(err.message || 'Não foi possível criar a conta.'); }
  };
  $('createHome').onclick = async () => {
    try { const {data,error:err}=await client.rpc('create_household'); if(err)throw err; householdId=data[0].household_id; await activateHousehold(); }
    catch(err){error('Não foi possível criar o espaço. Confira se o SQL de configuração foi executado.');}
  };
  $('joinHome').onclick = async () => {
    try { const {data,error:err}=await client.rpc('join_household',{p_code:$('inviteCode').value.trim()}); if(err)throw err; householdId=data; await activateHousehold(); }
    catch(err){error('Código inválido ou não foi possível entrar no espaço.');}
  };
  $('copyCode').onclick = async () => { try { await navigator.clipboard.writeText($('shareCode').textContent); message('Código copiado. Envie-o ao seu parceiro.'); } catch { message('Copie o código exibido e envie ao seu parceiro.'); } };
  $('signOut').onclick = async () => { await doSave(); await client.auth.signOut(); user=null; householdId=null; if(channel)client.removeChannel(channel); await refreshAuth(); message('Entre na sua conta para sincronizar os dados.'); showGate(); };
  if (!configured || !window.supabase?.createClient) {
    message('O app precisa ser conectado ao projeto Supabase antes de ativar a sincronização.');
    $('authForm').hidden=true; $('householdPanel').hidden=true;
    $('syncSetup').textContent='Configure supabase-config.js com a URL e a chave publicável do projeto; execute supabase-setup.sql no SQL Editor.';
    showGate(); return;
  }
  client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
  message('Crie uma conta para salvar e compartilhar os dados.');
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.user && !user) { user=session.user; setTimeout(()=>loadHousehold().catch(()=>error('Falha ao carregar o espaço compartilhado.')),0); }
  });
  client.auth.getSession().then(({data}) => {
    if(data.session){user=data.session.user;loadHousehold().catch(()=>{error('Falha ao carregar o espaço compartilhado.');showGate();});}
    else showGate();
  });
  window.addEventListener('online',()=>doSave());
  window.addEventListener('pagehide',()=>{ if(householdId) { try { localStorage.setItem('meuPlanoFinanceiro_v2',JSON.stringify(state)); } catch {} doSave(); } });
})();
