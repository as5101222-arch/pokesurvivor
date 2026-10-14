"""重新產生 js/data/lang-zh-names.js（寶可夢、招式、道具、屬性的官方繁中名）。

用法（在遊戲資料夾執行）：
  python tools/gen_zh_names.py <PokeAPI 的 csv 資料夾>
csv 來自 https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv
（需要 pokemon_species_names.csv、move_names.csv、item_names.csv、type_names.csv、ability_names.csv）。
招式／道具的對照是用原作英文語言檔（lang-en.js）的「西文 → 英文」配對，再用英文名查官方中文名。
"""
import csv, json, re, sys, os, subprocess
D = sys.argv[1].rstrip('/') + '/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def load(fn, idcol):
    en, zh = {}, {}
    for r in csv.DictReader(open(D + fn, encoding='utf-8')):
        if r['local_language_id'] == '9': en[r[idcol]] = r['name']
        elif r['local_language_id'] == '4': zh[r[idcol]] = r['name']
    return {en[i].lower(): zh[i] for i in en if i in zh}
maps = {k: load(f, c) for k, f, c in [('type', 'type_names.csv', 'type_id'), ('move', 'move_names.csv', 'move_id'),
                                        ('item', 'item_names.csv', 'item_id'), ('ability', 'ability_names.csv', 'ability_id')]}
# 原作的英文語言檔（西文 → 英文）。放在 tools/lang-en.js；沒有的話請從原作 js/data/lang-en.js 複製過來。
pairs = []
G_SHIM = "const out=[];global.G={I18n:{add:d=>{for(const[k,v] of Object.entries(d))out.push([k,v]);}}};eval(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(out));"
pairs = json.loads(subprocess.check_output(['node', '-e', G_SHIM, (os.path.join(ROOT, 'tools', 'lang-en.js') if os.path.exists(os.path.join(ROOT, 'tools', 'lang-en.js')) else os.path.join(ROOT, 'js', 'data', 'lang-en.js'))]))
auto = {}
for es, en in pairs:
    for kind in ('type', 'move', 'item', 'ability'):
        if en.lower() in maps[kind]: auto[es] = [en, kind, maps[kind][en.lower()]]; break
# 這些鍵在遊戲裡不是招式/道具名，改由 lang-zh-ui.js 處理
SKIP = {'Mejora', 'Fuerza', 'Imán', 'Enjambre', 'Normal', 'Síntesis'}
lines = []
for es, (en, kind, zh) in auto.items():
    if es in SKIP: continue
    lines.append(f"  {json.dumps(es, ensure_ascii=False)}: {json.dumps(zh, ensure_ascii=False)},")
# 寶可夢名：pokedex.js 裡的名字 → 官方繁中名（依全國圖鑑編號）
zh = {}
for r in csv.DictReader(open(D+'pokemon_species_names.csv', encoding='utf-8')):
    if r['local_language_id'] == '4': zh[int(r['pokemon_species_id'])] = r['name']
src = open(os.path.join(ROOT, 'js', 'data', 'pokedex.js'), encoding='utf-8').read()
dex = [(int(m.group(1)), json.loads(m.group(2))) for m in re.finditer(r'"dex":(\d+),"name":("(?:[^"\\]|\\.)*")', src)]
names, missing = [], []
for n, name in dex:
    if n in zh: names.append(f"  {json.dumps(name, ensure_ascii=False)}: {json.dumps(zh[n], ensure_ascii=False)},")
    else: missing.append((n, name))
out = ("/* ============ lang-zh-names.js — 官方中文名稱（自動產生） ============\n"
       " * 招式、道具、屬性與寶可夢的台灣官方中文名，來源：PokeAPI（zh-Hant）。\n"
       " * 由 tools/gen_zh_names.py 產生；要改個別翻譯，請改 lang-zh.js（它會覆蓋這裡）。\n */\n"
       "G.I18n.add({\n" + "\n".join(lines) + "\n}, 'zh');\n\n"
       "// 寶可夢名字：完全相符時翻譯，句子裡只比對大小寫完全相同的整個字（避免誤翻西文單字）\n"
       "G.I18n.addNames({\n" + "\n".join(names) + "\n}, 'zh');\n")
open(os.path.join(ROOT, 'js', 'data', 'lang-zh-names.js'), 'w', encoding='utf-8').write(out)
print(len(lines), 'terms;', len(names), 'pokemon; missing:', missing)
