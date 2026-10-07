"""Reproducible northern photo shortlist. Input: OpenNGC, CC BY-SA 4.0.
Snapshot downloaded 2026-09-06 from github.com/mattiaverga/OpenNGC.
The derived dataset is also CC BY-SA 4.0; no inferred magnitudes.
"""
import csv,json,re,hashlib,pathlib,collections
root=pathlib.Path(__file__).resolve().parents[1]
rows=list(csv.DictReader((root/'data/OpenNGC.csv').open(),delimiter=';'))
base=json.loads(re.search(r'const CATALOG=(\[.*?\]);',(root/'dist/index.html').read_text(),re.S)[1])
excluded={f'NGC{int(n):04}' for d in base for n in re.findall(r'\d+',d['ngc'])}
# Northern Caldwell NGC/IC entries (C14 contains two distinct clusters).
caldwell={}
sequence={1:'NGC188',2:'NGC40',3:'NGC4236',4:'NGC7023',5:'IC342',6:'NGC6543',7:'NGC2403',8:'NGC559',10:'NGC663',11:'NGC7635',12:'NGC6946',13:'NGC457',14:'NGC869 NGC884',15:'NGC6826',16:'NGC7243',17:'NGC147',18:'NGC185',19:'IC5146',20:'NGC7000',21:'NGC4449',22:'NGC7662',23:'NGC891',24:'NGC1275',25:'NGC2419',26:'NGC4244',27:'NGC6888',28:'NGC752',29:'NGC5005',30:'NGC7331',31:'IC405',32:'NGC4631',33:'NGC6992',34:'NGC6960',35:'NGC4889',36:'NGC4559',37:'NGC6885',38:'NGC4565',39:'NGC2392',40:'NGC3626',42:'NGC7006',43:'NGC7814',44:'NGC7479',45:'NGC5248',46:'NGC2261',47:'NGC6934',48:'NGC2775',49:'NGC2237',50:'NGC2244',51:'IC1613',52:'NGC4697',53:'NGC3115',54:'NGC2506'}
for c,names in sequence.items():
 for name in names.split():
  p,n=re.fullmatch(r'(NGC|IC)(\d+)',name).groups();caldwell[f'{p}{int(n):04}']=c
def number(r,k):return float(r[k]) if r[k] else None
def coord(s,hours=False):
 a,b,c=map(float,s.split(':'));return (abs(a)+b/60+c/3600)*(-1 if s[0]=='-' else 1)*(15 if hours else 1)
labels={'G':'Galaxy','OCl':'Open cluster','GCl':'Globular cluster','Cl+N':'Cluster + nebula','EmN':'Emission nebula','HII':'Emission nebula','Neb':'Nebula','RfN':'Reflection nebula','SNR':'Supernova remnant','PN':'Planetary nebula'}
candidates=[]
for r in rows:
 if r['M'] or r['Name'] in excluded or r['Type'] not in labels or not re.fullmatch(r'(NGC|IC)\d+',r['Name']) or not r['RA']:continue
 if coord(r['Dec']) < -12.589:continue
 a=number(r,'MajAx') or 0;v=number(r,'V-Mag');b=number(r,'B-Mag');sb=number(r,'SurfBr');t=r['Type'];c=caldwell.get(r['Name'])
 if t=='G':ok=a>=5 and ((v is not None and v<=12) or (v is None and b is not None and b<=12.5)) and (sb is None or sb<=24.5)
 elif t in ['OCl','GCl']:ok=a>=5 and v is not None and v<=10
 else:ok=t!='PN' and a>=10
 if c or ok:candidates.append(r)
selected=[r for r in candidates if r['Name'] in caldwell]
# Balance object classes rather than letting the numerous galaxies dominate.
for types,quota in [(['G'],65),(['OCl','GCl'],55),(['Neb','EmN','HII','Cl+N','RfN','SNR'],55)]:
 pool=[r for r in candidates if r['Type'] in types and r not in selected]
 pool.sort(key=lambda r:(not bool(r['Common names']),number(r,'V-Mag') or number(r,'B-Mag') or 99,-(number(r,'MajAx') or 0),r['Name']))
 selected+=pool[:max(0,quota-sum(r['Type'] in types for r in selected))]
out=[]
for r in sorted(selected,key=lambda r:r['Name']):
 prefix,num=re.fullmatch(r'(NGC|IC)(\d+)',r['Name']).groups();designation=f'{prefix} {int(num)}';a=number(r,'MajAx');b=number(r,'MinAx');c=caldwell.get(r['Name']);t=r['Type']
 aliases=[designation]+([f'C{c}',f'Caldwell {c}'] if c else [])
 for col in ['NGC','IC']:
  for alias in r[col].split(','):
   if alias.strip().isdigit():aliases.append(f'{col} {int(alias)}')
 v=number(r,'V-Mag');bm=number(r,'B-Mag');name=r['Common names'].replace(',', ' / ')
 reason=f'Caldwell {c}: selected northern target; compact or faint entries may be challenging.' if c else ('Large galaxy with a published optical magnitude.' if t=='G' else 'Extended nebula candidate; exposure difficulty varies.' if t not in ['OCl','GCl'] else 'Resolved cluster with useful angular extent and published brightness.')
 if a is None:size='';display='Size unknown'
 else:size=f'{a:g}'+(f'x{b:g}' if b else '');display=size.replace('x',' × ')+'′'
 out.append(dict(id=(10000 if prefix=='NGC' else 20000)+int(num),designation=designation,ngc=num if prefix=='NGC' else '',type=t,label=labels[t],name=name,con=r['Const'],ra=r['RA'],dec=r['Dec'],ra_deg=coord(r['RA'],True),dec_deg=coord(r['Dec']),size=size,size_display=display,major=a,minor=b,mag=v if v is not None else bm,mag_band='V' if v is not None else 'B' if bm is not None else None,surface_brightness=number(r,'SurfBr'),aliases=aliases,collection='extended',caldwell=c,reason=reason,note='Catalog extent may describe only the cluster or bright region; surrounding nebulosity can be much larger.' if t=='Cl+N' else '',target=designation,sources=r['Sources']))
assert 100<=len(out)<=200
assert len({r['id'] for r in out})==len(out)
# Common photographic region names supplement cluster-centric catalog names.
for d in out:
 if d['designation']=='NGC 7023':
  d['label']='Reflection nebula';d['photo_group']='reflection'
 if d['designation'] in ['IC 1805','IC 1848']:
  d['name']={'IC 1805':'Heart Nebula / associated cluster','IC 1848':'Soul Nebula / associated cluster'}[d['designation']]
  d['photo_group']='emission'
payload={'source':'OpenNGC','url':'https://github.com/mattiaverga/OpenNGC','license':'CC BY-SA 4.0','snapshot':'2026-09-06','sha256':hashlib.sha256((root/'data/OpenNGC.csv').read_bytes()).hexdigest(),'objects':out}
(root/'dist/deep-catalog.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')))
(root/'dist/deep-catalog.js').write_text('/* Derived from OpenNGC, CC BY-SA 4.0; see deep-catalog.json. */\nwindow.DEEP_SKY_CATALOG='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(out),'additional objects',collections.Counter(r['type'] for r in out))
