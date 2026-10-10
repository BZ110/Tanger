"""Original Bebben mesh authoring. Run from the repository root with Blender 4.5.

All surfaces, UVs, texture paint, weights, keys and animation are authored here;
no base mesh, scan, downloaded asset or game extraction is used.
"""
raise SystemExit("Archived v1 initializer. Use persistent Blender Artist Mode; this whole-character generator is retired.")

import bpy
import bmesh
import math
import pathlib
import numpy as np
from mathutils import Vector

ROOT = pathlib.Path.cwd()
OUT = ROOT / 'art/characters/bebben/source'
OUT.mkdir(parents=True, exist_ok=True)
TEX = OUT / 'textures'
TEX.mkdir(exist_ok=True)
pi = math.pi
sin, cos, exp = math.sin, math.cos, math.exp
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials:
    bpy.data.materials.remove(d)
export = bpy.data.collections.new('EXPORT')
bpy.context.scene.collection.children.link(export)
studio = bpy.data.collections.new('STUDIO — excluded from export')
bpy.context.scene.collection.children.link(studio)
meshes = []
weights = {}


def paint(name, color, style, size=1024):
    """Reproducible original color artwork in UV space; packed and external PNG."""
    v, u = np.mgrid[0:size, 0:size].astype(np.float32) / (size - 1)
    c = np.empty((size, size, 4), dtype=np.float32)
    c[:, :, :3] = color
    c[:, :, 3] = 1
    if style == 'skin':
        cheeks = np.exp(-((u-.29)/.115)**2-((v-.40)/.09)**2)
        cheeks += np.exp(-((u-.71)/.115)**2-((v-.40)/.09)**2)
        c[:, :, :3] += cheeks[:, :, None] * np.array([.025,-.035,-.035])
        c[:, :, :3] += (np.exp(-((v-.63)/.3)**2)*.02)[:, :, None]
    elif style == 'hair':
        stripe = (.5+.5*np.cos(u*pi*4+.28*np.sin(v*pi*2)))**8
        band = np.exp(-((v-.60)/.15)**2)
        c[:, :, :3] += (stripe*band*.055)[:, :, None] * np.array([.65,.78,1.])
        c[:, :, :3] *= (.87+.13*np.sin(v*pi))[:, :, None]
    elif style == 'cloth':
        weave = np.sin(u*pi*size/2)*np.sin(v*pi*size/2)*.006
        broad = .98+.02*np.cos(u*pi*4)*np.sin(v*pi*2)
        c[:, :, :3] = c[:, :, :3]*broad[:, :, None]+weave[:, :, None]
    elif style == 'iris':
        x, y = (u-.5)*2, (v-.5)*2
        r = np.sqrt(x*x+y*y)
        a = np.arctan2(y,x)
        fiber = .92+.08*np.cos(a*45+np.sin(r*30))
        golden = np.exp(-((r-.62)/.18)**2)*fiber
        c[:, :, :3] = np.array([.075,.035,.019]) + golden[:, :, None]*np.array([.32,.17,.055])
        pupil = np.clip((r-.32)/.05,0,1)
        rim = np.clip((.99-r)/.15,0,1)
        c[:, :, :3] *= (pupil*rim)[:, :, None]
        c[:, :, :3] += .009
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    image.pixels.foreach_set(np.clip(c,0,1).ravel())
    image.filepath_raw = str(TEX / (name+'.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    image.filepath = '//textures/'+name+'.png'
    return image


def material(name, color, rough=.6, metal=0, texture=None):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metal
    if texture:
        t=m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image=texture
        m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m


skin=material('Skin',(.64,.40,.28),.72,texture=paint('skin-painted',(.77,.57,.44),'skin',2048))
hair=material('Hair',(.017,.023,.033),.68,texture=paint('hair-flow',(.025,.030,.040),'hair'))
cloth=material('Clothing',(.06,.075,.09),.87,texture=paint('jacket-weave',(.155,.171,.19),'cloth'))
pants=material('Trousers',(.08,.10,.12),.9,texture=paint('cargo-weave',(.23,.255,.27),'cloth'))
rib=material('Ribbing',(.047,.055,.065),.93)
leather=material('Leather',(.034,.042,.052),.48)
sole=material('Sole',(.018,.024,.029),.9)
metal=material('Hardware',(.29,.34,.39),.32,.75)
accent=material('Orange',(.93,.235,.042),.62)
eye=material('Eyes',(.9,.86,.77),.32)
iris=material('Iris',(.20,.09,.025),.39,texture=paint('iris-brown',(.3,.14,.05),'iris',1024))
ink=material('Ink',(.014,.009,.01),.85)
lip=material('Lip',(.41,.19,.145),.68)
glint=material('Eye-light',(.98,.97,.94),.17)


def mesh(name, vertices, faces, mat, uv=None, weight='head', morphs=None):
    d=bpy.data.meshes.new(name+' · topology')
    d.from_pydata(vertices,[],faces)
    d.update()
    o=bpy.data.objects.new(name,d)
    export.objects.link(o)
    d.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(d)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(d);bm.free()
    for p in d.polygons:p.use_smooth=True
    layer=d.uv_layers.new(name='AuthoredUV')
    for loop in d.loops:
        co=d.vertices[loop.vertex_index].co
        layer.data[loop.index].uv=uv[loop.vertex_index] if uv else (co.x*2+.5,co.z/1.8)
    if morphs:
        o.shape_key_add(name='Basis')
        for key,coordinates in morphs.items():
            sk=o.shape_key_add(name=key)
            for p,co in zip(sk.data,coordinates):p.co=co
    meshes.append(o)
    weights[o.name]=weight
    return o


def interp(t, knots):
    if t<=knots[0][0]:return np.array(knots[0][1:])
    for idx,(a,b) in enumerate(zip(knots,knots[1:])):
        if t<=b[0]:
            # Continuous monotone Hermite tangents avoid horizontal scalloping.
            av,bv=np.array(a[1:]),np.array(b[1:])
            h=b[0]-a[0];delta=(bv-av)/h
            before=knots[max(0,idx-1)];after=knots[min(len(knots)-1,idx+2)]
            ma=(bv-np.array(before[1:]))/(b[0]-before[0])
            mb=(np.array(after[1:])-av)/(after[0]-a[0])
            ma=np.where(ma*delta>0,np.sign(delta)*np.minimum(abs(ma),3*abs(delta)),0)
            mb=np.where(mb*delta>0,np.sign(delta)*np.minimum(abs(mb),3*abs(delta)),0)
            s=(t-a[0])/h
            return (2*s**3-3*s*s+1)*av+(s**3-2*s*s+s)*h*ma+(-2*s**3+3*s*s)*bv+(s**3-s*s)*h*mb
    return np.array(knots[-1][1:])


def loft(name, rings, mat, n=48, weight='pelvis', folds=0, caps=True):
    """Shaped elliptical cross sections; ring=(z,cx,cy,rx,ry)."""
    vs=[];uv=[]
    for j,(z,x,y,rx,ry) in enumerate(rings):
        for i in range(n):
            a=2*pi*i/n
            f=1+folds*sin(a*5+j*.8)*sin(pi*j/(len(rings)-1))**2
            vs.append((x+rx*sin(a)*f,y-ry*cos(a)*f,z))
            uv.append((i/n,j/(len(rings)-1)))
    fs=[]
    for j in range(len(rings)-1):
        for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if caps:
        fs += [tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+i for i in range(n))]
    return mesh(name,vs,fs,mat,uv,weight)


def sweep(name, pts, widths, depths, mat, weight='head', n=12):
    """Curved flattened volumes with deliberate cross sections, including hair locks."""
    vs=[];uv=[]
    for j,p in enumerate(pts):
        center=Vector(p)
        tangent=Vector(pts[min(j+1,len(pts)-1)])-Vector(pts[max(0,j-1)])
        tangent.normalize()
        side=tangent.cross(Vector((0,-1,0)))
        if side.length<.01:side=tangent.cross(Vector((1,0,0)))
        side.normalize();normal=side.cross(tangent).normalized()
        for i in range(n):
            a=2*pi*i/n
            co=center+side*(cos(a)*widths[j])+normal*(sin(a)*depths[j])
            vs.append(tuple(co));uv.append((i/n,j/(len(pts)-1)))
    fs=[]
    for j in range(len(pts)-1):
        for i in range(n):fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    fs += [tuple(range(n-1,-1,-1)),tuple((len(pts)-1)*n+i for i in range(n))]
    return mesh(name,vs,fs,mat,uv,weight)


def line(name, pts, radius, mat, weight='head', morphs=None):
    o=sweep(name,pts,[radius]*len(pts),[radius]*len(pts),mat,weight,n=8)
    if morphs:
        o.shape_key_add(name='Basis')
        for k,fn in morphs.items():
            key=o.shape_key_add(name=k)
            for a,b in zip(key.data,o.data.vertices):a.co=fn(b.co.copy())
    return o


def panel(name, outline, mat, weight, thick=.003, bevel=.002):
    # Editable edge-built sewn panels, with real side walls and softened corners.
    o=mesh(name,outline,[tuple(range(len(outline)))],mat,weight=weight)
    s=o.modifiers.new('Sewn panel thickness','SOLIDIFY');s.thickness=thick
    b=o.modifiers.new('Soft panel edge','BEVEL');b.width=bevel;b.segments=3
    return o


# Face: continuous shaped front/back surface, explicitly open orbital topology.
NX,NZ=64,80
Z0,Z1=1.408,1.756
shape=[(1.408,.004,.039,.038),(1.422,.042,.061,.045),(1.45,.076,.070,.071),
       (1.49,.101,.077,.090),(1.54,.116,.078,.104),(1.59,.119,.079,.111),
       (1.66,.113,.079,.112),(1.71,.091,.065,.09),(1.745,.044,.037,.043),(1.756,.002,.002,.002)]
eye_z=Z0+(Z1-Z0)*39/NZ
EYES=[(18,39,'R',-1),(46,39,'L',1)]


def face_y(x,z):
    width,front,back=interp(z,shape)
    y=-front*max(0,1-(x/max(width,.001))**2)**.38
    # Actual nasal bridge, tip, alar planes; lips, chin and cheek planes.
    y-=.030*exp(-(x/.014)**2-((z-1.528)/.022)**2)
    y-=.017*exp(-(x/.010)**2-((z-1.563)/.037)**2)
    y-=.007*exp(-(x/.022)**2-((z-1.516)/.008)**2)
    y-=.007*exp(-(x/.031)**2-((z-1.477)/.008)**2)
    y-=.010*exp(-(x/.043)**2-((z-1.438)/.013)**2)
    y-=.009*exp(-((abs(x)-.070)/.031)**2-((z-1.521)/.031)**2)
    return y


vs=[];uv=[];front_indices={};back_indices={};eye_boundary={}
for j in range(NZ+1):
    z=Z0+(Z1-Z0)*j/NZ
    width=interp(z,shape)[0]
    for i in range(NX+1):
        x=(i/NX*2-1)*width
        # Map each square eye perimeter onto an almond and smoothly relax surrounding loops.
        for ci,cj,side,sign in EYES:
            dx,dz=(i-ci)/8,(j-cj)/4
            r=max(abs(dx),abs(dz))
            if .99<=r<2.0:
                a=math.atan2(dz,dx)
                cx=(ci/NX*2-1)*interp(eye_z,shape)[0]
                targetx=cx+.034*cos(a)*r
                targetz=eye_z+.0145*sin(a)*(0.86+.14*abs(sin(a)))+sign*.003*cos(a)
                targetz=eye_z+(targetz-eye_z)*r
                f=max(0,2-r)
                x=x*(1-f)+targetx*f
                z_here=z*(1-f)+targetz*f
                if abs(r-1)<.001:eye_boundary[(i,j)]=(side,cx)
                break
        else:z_here=z
        y=face_y(x,z_here)
        # Orbital shelf follows convex eye seating, eliminating recessed sticker eyes.
        for ci,cj,side,sign in EYES:
            cx=(ci/NX*2-1)*interp(eye_z,shape)[0]
            r=((x-cx)/.034)**2+((z_here-eye_z)/.016)**2
            y-=.009*exp(-((math.sqrt(r)-1)/.45)**2)
        front_indices[(i,j)]=len(vs)
        vs.append((x,y,z_here));uv.append((x/.26+.5,(z_here-Z0)/(Z1-Z0)))
for j in range(NZ+1):
    z=Z0+(Z1-Z0)*j/NZ
    width,fr,ba=interp(z,shape)
    for i in range(NX+1):
        if i in (0,NX) or j in (0,NZ):back_indices[(i,j)]=front_indices[(i,j)];continue
        x=(i/NX*2-1)*width
        back_indices[(i,j)]=len(vs)
        vs.append((x,ba*max(0,1-(x/width)**2)**.5,z));uv.append((.05+i/NX*.10,j/NZ))
fs=[]
for j in range(NZ):
    for i in range(NX):
        hole=any(ci-8<=i<ci+8 and cj-4<=j<cj+4 for ci,cj,_,_ in EYES)
        if not hole:fs.append(tuple(front_indices[q] for q in ((i,j),(i+1,j),(i+1,j+1),(i,j+1))))
        fs.append(tuple(back_indices[q] for q in ((i,j+1),(i+1,j+1),(i+1,j),(i,j))))


def closed_z(x,cx):return eye_z-.002+(.003 if cx>0 else -.003)*(x-cx)/.034


def face_blink(co,side):
    x,y,z=co
    if y>-.03:return co
    ci=46 if side=='L' else 18
    cx=(ci/NX*2-1)*interp(eye_z,shape)[0]
    dx=(x-cx)/.034
    dz=(z-eye_z-sign_for(cx)*.003*dx)/.0145
    r=math.sqrt(dx*dx+dz*dz)
    if r<2.8:
        t=max(0,min(1,(r-1)/1.8))
        f=1-t*t*(3-2*t)
        z=z+(closed_z(x,cx)-z)*f*.998
        # Closed eyelid skin lies on a calm facial plane, not the open orbital roll.
        y=y*(1-f)+(face_y(x,z)-.0025)*f
    return (x,y,z)


def sign_for(x):return 1 if x>0 else -1


def smile_face(co):
    x,y,z=co
    g=exp(-((abs(x)-.031)/.023)**2-((z-1.482)/.029)**2)
    return (x*(1+.045*g),y-.002*g,z+.008*g)


face=mesh('Face — orbital loops / sculpted nose and jaw',vs,fs,skin,uv,'head',
          {'blink.L':[face_blink(v,'L') for v in vs],'blink.R':[face_blink(v,'R') for v in vs],
           'smile':[smile_face(v) for v in vs]})
# Delete unused vertices from the true orbital openings (not hidden internal surfaces).
# Keep them in the source key topology until the export set is finalized below.


for ci,cj,side,sign in EYES:
    cx=(ci/NX*2-1)*interp(eye_z,shape)[0]
    # Convex scleral almond seated within the actual hole. Radial UV layout.
    ev=[];eu=[];ef=[];N=64;R=12
    for k in range(R+1):
        r=max(.0001,k/R)
        for i in range(N):
            a=2*pi*i/N
            x=cx+.034*r*cos(a)
            z=eye_z+.0145*r*sin(a)*(.86+.14*abs(sin(a)))+sign*.003*r*cos(a)
            y=face_y(x,z)-.004-.008*(1-r*r)
            ev.append((x,y,z));eu.append((.5+.5*r*cos(a),.5+.5*r*sin(a)))
    for k in range(R):
        for i in range(N):ef.append((k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i))

    def eye_blink(v):
        x,y,z=v
        return (x,y+.007,closed_z(x,cx)+(z-closed_z(x,cx))*.005)

    mesh('Sclera.'+side,ev,ef,eye,eu,'head',{'blink.'+side:[eye_blink(v) for v in ev]})
    # Iris domed disk with hand-authored radial brown texture and dark limbal ring.
    iv=[];iu=[];ifr=[]
    for k in range(13):
        r=max(.0001,k/12)
        for i in range(64):
            a=2*pi*i/64
            x=cx+.0135*r*cos(a);z=eye_z+.0138*r*sin(a)
            y=face_y(cx,eye_z)-.015+.003*r*r
            iv.append((x,y,z));iu.append((.5+.5*r*cos(a),.5+.5*r*sin(a)))
    for k in range(12):
        for i in range(64):ifr.append((k*64+i,k*64+(i+1)%64,(k+1)*64+(i+1)%64,(k+1)*64+i))
    mesh('Brown iris.'+side,iv,ifr,iris,iu,'head',{'blink.'+side:[eye_blink(v) for v in iv]})
    for number,(dx,dz,r) in enumerate([(-.0035,.005,.0029),(.003,-.004,.0011)]):
        gv=[];gf=[]
        for k in range(2):
            for i in range(32):
                a=i/32*2*pi
                gv.append((cx+dx+r*k*cos(a),face_y(cx,eye_z)-.0165,eye_z+dz+r*k*sin(a)))
        for i in range(32):gf.append((i,(i+1)%32,32+(i+1)%32,32+i))
        mesh(f'Eye catchlight {number}.{side}',gv,gf,glint,weight='head',morphs={'blink.'+side:[eye_blink(v) for v in gv]})
    # Lids are narrow skin rolls around the opening; upper lash follows the key.
    for upper in (True,False):
        pts=[]
        for i in range(41):
            a=(i/40*pi) if upper else (pi+i/40*pi)
            x=cx+.034*cos(a)
            z=eye_z+.0145*sin(a)*(.86+.14*abs(sin(a)))+sign*.003*cos(a)
            pts.append((x,face_y(x,z)-.0095,z))
        line(('Upper lid.' if upper else 'Lower lid.')+side,pts,.00155 if upper else .0011,skin,
             morphs={'blink.'+side:lambda v,cx=cx: Vector((v.x,face_y(v.x,closed_z(v.x,cx))-.003,closed_z(v.x,cx)+(v.z-closed_z(v.x,cx))*.008))})
        if upper:
            line('Upper lash.'+side,[(x,y-.0015,z+.0005) for x,y,z in pts],.00085,ink,
                 morphs={'blink.'+side:lambda v,cx=cx: Vector((v.x,face_y(v.x,closed_z(v.x,cx))-.003,closed_z(v.x,cx)+(v.z-closed_z(v.x,cx))*.008))})
    brow=[]
    for i in range(25):
        t=i/24;x=cx+(t-.5)*.064
        z=eye_z+.030+.003*sin(pi*t)+sign*.002*(t-.5)
        brow.append((x,face_y(x,z)-.0025,z))
    sweep('Soft eyebrow.'+side,brow,[.001+sin(pi*i/24)*.0013 for i in range(25)],[.0008]*25,hair)

# Mouth is a recessed narrow opening with sculpted upper/lower lip curves.
mouth=[]
for i in range(49):
    t=i/48;x=(t-.5)*.059;z=1.477+.0008*cos(t*2*pi)
    mouth.append((x,face_y(x,z)-.0007,z))


def smile_mouth(v):
    x,y,z=v;f=(abs(x)/.03)**1.7
    return Vector((x*1.13,y-.001,z+.008*f-.0006))


line('Mouth inset',mouth,.00065,ink,morphs={'smile':smile_mouth})
for upper in (True,False):
    pts=[]
    for x,y,z in mouth:
        f=max(0,1-(x/.030)**2)
        pts.append((x,y-.0001,z+(.0012 if upper else -.0014)*f))
    line('Upper vermilion' if upper else 'Lower vermilion',pts,.00042,lip,morphs={'smile':smile_mouth})
# Small inset nostril arcs, kept subordinate to the modeled nose planes.
for sign in (-1,1):
    pts=[]
    for i in range(13):
        a=pi*i/12;x=sign*(.011+.0035*cos(a));z=1.514+.0012*sin(a)
        pts.append((x,face_y(x,z)-.0006,z))
    line('Nostril '+str(sign),pts,.00035,lip)

# Ears: shaped outer helix + inset concha, not sphere attachments.
for sign,side in [(-1,'R'),(1,'L')]:
    vs=[];uv=[];fs=[]
    for k in range(9):
        r=k/8
        for i in range(48):
            a=i/48*2*pi
            x=sign*(.112+.018*r*(.75+.25*cos(a)))
            y=.005-.022*r*cos(a)
            z=1.556+.039*r*sin(a)
            x+=sign*.004*sin(pi*r)
            vs.append((x,y,z));uv.append((.5+.4*r*cos(a),.5+.4*r*sin(a)))
    for k in range(8):
        for i in range(48):fs.append((k*48+i,k*48+(i+1)%48,(k+1)*48+(i+1)%48,(k+1)*48+i))
    ear=mesh('Sculpted ear.'+side,vs,fs,skin,uv)
    sol=ear.modifiers.new('Ear shell','SOLIDIFY');sol.thickness=.006
    arc=[]
    for i in range(41):
        a=-.7+4.8*i/40
        arc.append((sign*(.119+.012),-.013*cos(a),1.554+.026*sin(a)))
    line('Ear inner fold.'+side,arc,.002,skin)

# Neck transitions under the jaw, trapezius and shirt collar.
loft('Neck',[(1.27,0,.014,.055,.046),(1.31,0,.009,.050,.043),(1.36,0,.008,.043,.040),
             (1.40,0,.009,.041,.038),(1.446,0,.020,.050,.047)],skin,weight=lambda v:{'neck':.65,'head':.35} if v.z>1.40 else {'neck':1})

# Hair: an understated fitted underlayer plus authored overlapping flattened locks.
hr=[]
for j in range(25):
    z=1.585+(1.774-1.585)*j/24
    width,depth=interp(z,[(1.585,.125,.114),(1.65,.126,.120),(1.71,.106,.106),
                         (1.755,.057,.058),(1.774,.001,.001)])
    hr.append((z,0,.010,width,depth))
cap=loft('Hair underlayer',hr,hair,n=64,weight='head')
# Hide the front lower cap behind the fringe by lifting its front hairline.
for v in cap.data.vertices:
    if v.co.y<0:
        t=(v.co.z-1.585)/(1.774-1.585)
        v.co.z+=.110*(-v.co.y/.12)*(1-t)


def lock(name, controls, width, depth=.009):
    # Cubic Bezier centerline with broad root, changing ridge and a tapered tip.
    pts=[];ws=[];ds=[]
    a,b,c,d=map(Vector,controls)
    for i in range(25):
        t=i/24
        p=(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d
        pts.append(tuple(p))
        w=width*(.58+.6*sin(pi*t*.9))*(1-t)**.55+.00025
        ws.append(w);ds.append(depth*.48*(.65+.35*sin(pi*t))*(1-t)**.65+.00015)
    return sweep(name,pts,ws,ds,hair,n=12)

# Primary fringe sweeps from a left-of-center crown into varied, clean tips.
fringe=[(-.100,1.612,.025),(-.072,1.643,.029),(-.038,1.626,.030),
        (-.002,1.631,.028),(.031,1.654,.024),(.061,1.634,.023),(.089,1.601,.020)]
for i,(x,z,w) in enumerate(fringe):
    lock('Fringe / layer '+str(i+1),[(-.047+i*.012,-.065,1.752),
         (x-.023,-.118,1.724),(x+.011,-.111,1.672),(x,-.087 if abs(x)>.08 else -.099,z)],w,.010)
# Crown directional locks; intentional asymmetric lofted ridges.
for i in range(9):
    a=-1.3+i*.31
    sx=.08*sin(a);sy=.075*cos(a)
    lock('Crown sweep '+str(i+1),[(-.03,.002,1.768),(sx,.015,1.787),
        (sx*1.5,sy*.8,1.765),(sx*1.47,sy,1.701+(.018 if i%2 else 0))],.023,.011)
for sign,side in [(-1,'R'),(1,'L')]:
    for i in range(4):
        y=-.045+i*.038
        lock('Temple / '+side+str(i),[(sign*.079,y*.5,1.741),(sign*.137,y,1.716),
             (sign*.137,y-.012,1.632),(sign*(.114+.006*(i%2)),y-.008,1.574+i*.008)],.020,.009)
    for i in range(4):
        x=sign*(.025+i*.024)
        lock('Nape / '+side+str(i),[(x,.069,1.728),(x*1.3,.132,1.701),
             (x*1.24,.125,1.627),(x*1.1,.101,1.564+(i%2)*.022)],.023,.01)
# Two small messy crown wisps, shaped leaf volumes rather than hair tubes.
lock('Crown wisp A',[(-.025,.015,1.776),(-.041,.004,1.817),(-.055,.01,1.814),(-.062,.006,1.799)],.006,.004)
lock('Crown wisp B',[(.026,.02,1.776),(.049,.034,1.802),(.065,.043,1.800),(.078,.039,1.789)],.007,.004)


# Torso: modeled clothing section shapes, hem, shoulder yoke and stand collar.
body_knots=[(.947,0,.006,.133,.083),(.976,0,.005,.141,.089),(1.045,0,.002,.145,.091),
            (1.14,0,.004,.155,.091),(1.23,0,.004,.17,.099),(1.292,0,.012,.184,.095),
            (1.322,0,.014,.165,.079),(1.345,0,.013,.068,.046)]
body_rings=[(z,*interp(z,body_knots)) for z in np.linspace(.947,1.345,45)]


def torso_weights(v):
    if v.z<1.0:return {'pelvis':1}
    if v.z<1.16:
        t=(v.z-1.0)/.16
        return {'pelvis':1-t,'spine':t}
    t=min(1,(v.z-1.16)/.13)
    return {'spine':1-t,'chest':t}


jacket=loft('Utility jacket / continuous body',body_rings,cloth,n=64,weight=torso_weights,folds=.016)
loft('Ribbed jacket hem',[(.945,0,.006,.135,.085),(.953,0,.006,.139,.087),(.975,0,.006,.14,.088)],rib,weight='pelvis')
loft('Standing collar',[(1.315,0,.012,.064,.054),(1.327,0,.012,.064,.052),
                       (1.356,0,.010,.061,.051),(1.362,0,.010,.060,.050)],cloth,weight='neck',caps=False)
loft('Collar binding',[(1.358,0,.01,.061,.051),(1.363,0,.01,.061,.051)],rib,weight='neck',caps=False)
# Center front zipper, separate tape and teeth with original restrained detail.
zippts=[]
for i in range(60):
    z=.979+(1.331-.979)*i/59
    _,cy,rx,ry=interp(z,body_knots)
    zippts.append((0,cy-ry-.002,z))
line('Front zipper tape',zippts,.003,rib,torso_weights)
line('Front zipper chain',[(x,y-.0015,z) for x,y,z in zippts],.0009,metal,torso_weights)
panel('Zipper slider',[(-.004,-.047,1.330),(.004,-.047,1.330),(.004,-.048,1.318),(-.004,-.048,1.318)],metal,'chest',.002)
for sign,side in [(-1,'R'),(1,'L')]:
    # Chest pockets follow the curved torso; seams and gussets sit on the shell.
    outline=[(sign*.023,-.097,1.222),(sign*.099,-.079,1.222),(sign*.100,-.080,1.155),
             (sign*.078,-.090,1.146),(sign*.023,-.098,1.151)]
    panel('Chest patch pocket.'+side,outline,cloth,'chest',.004)
    flap=[(sign*.020,-.100,1.224),(sign*.102,-.082,1.224),(sign*.097,-.085,1.202),
          (sign*.057,-.097,1.198),(sign*.022,-.100,1.204)]
    panel('Pocket flap.'+side,flap,cloth,'chest',.004)
    line('Pocket topstitch.'+side,[(x,y-.002,z) for x,y,z in outline+[outline[0]]],.0006,pants,'chest')
    x=sign*.065
    panel('Pocket snap.'+side,[(x-.003,-.103,1.212),(x+.003,-.103,1.212),
          (x+.003,-.103,1.206),(x-.003,-.103,1.206)],metal,'chest',.001,.0015)
    # Lower welt pockets / diagonal entrance, avoid a random hard-surface panel pile.
    pts=[(sign*(.06+.06*t),-.084+.025*t,1.067+.031*t) for t in np.linspace(0,1,25)]
    line('Welt pocket.'+side,pts,.0022,rib,torso_weights)
    # Back yoke and side construction lines.
    pts=[]
    for t in np.linspace(0,1,33):
        x=sign*.155*t
        pts.append((x,.101-.034*t*t,1.263+.004*t))
    line('Back yoke seam.'+side,pts,.0008,pants,'chest')

# Arms, structured sleeve elbows, wrists, palms and independently shaped fingers.
joint_locations={}
for sign,side in [(-1,'R'),(1,'L')]:
    shoulder=Vector((sign*.174,.006,1.294))
    elbow=Vector((sign*.282,.004,1.104))
    wrist=Vector((sign*.376,-.010,.939))
    handend=Vector((sign*.419,-.013,.865))
    joint_locations[side]=(shoulder,elbow,wrist,handend)

    def arm_weight(v,side=side,elbow=elbow,wrist=wrist):
        t=(v.z-elbow.z)/.07
        if t>=1:return {'upper_arm.'+side:1}
        if t<=-1:return {'forearm.'+side:1}
        t=(t+1)/2
        return {'upper_arm.'+side:t,'forearm.'+side:1-t}

    pts=[];ws=[];ds=[]
    for i in range(41):
        t=i/40
        p=shoulder.lerp(elbow,t*2) if t<.5 else elbow.lerp(wrist,(t-.5)*2)
        p.x-=sign*.022*max(0,1-t/.2)**2
        p.y+=.004*sin(pi*t)
        r=float(interp(t,[(0,.061),(.15,.064),(.4,.052),(.5,.053),(.6,.052),(.85,.038),(1,.032)])[0])
        r*=1+.015*sin(t*pi*9)*exp(-((t-.53)/.15)**2)
        pts.append(tuple(p));ws.append(r);ds.append(r*.85)
    sweep('Jacket sleeve.'+side,pts,ws,ds,cloth,arm_weight,n=40)
    end=(wrist-elbow).normalized()
    sweep('Ribbed cuff.'+side,[tuple(wrist-end*.018),tuple(wrist-end*.01),tuple(wrist+end*.006)],
          [.033,.033,.03],[.028,.028,.025],rib,'forearm.'+side,n=40)
    # Tonal outer sleeve seam; soft elbow darts.
    seam=[(p[0]+sign*w*.92,p[1]-.008,p[2]) for p,w in zip(pts,ws)]
    line('Sleeve seam.'+side,seam,.0007,pants,arm_weight)
    if side=='L':
        # Single modest orange utility pull tab on the upper sleeve.
        panel('Orange sleeve pull tab',[(.235,-.045,1.259),(.246,-.044,1.255),
              (.257,-.044,1.222),(.247,-.046,1.219)],accent,'upper_arm.L',.004,.002)
        line('Pull tab stitch',[(.242,-.048,1.25),(.250,-.049,1.225)],.00055,rib,'upper_arm.L')
    # Palm with separate thumb saddle and knuckle contour. Hand lies in XZ plane.
    direction=(handend-wrist).normalized()
    pp=[tuple(wrist-end*.005),tuple(wrist+direction*.018),tuple(wrist+direction*.041),tuple(wrist+direction*.060)]
    palm=sweep('Palm.'+side,pp,[.023,.028,.030,.026],[.016,.018,.017,.014],skin,'hand.'+side,n=32)
    tangent=Vector((sign*.866,0,.5))
    # Four digits taper through joint loops; each has two exported deform bones.
    for f,(offset,length) in enumerate([(-.020,.045),(-.007,.056),(.007,.054),(.020,.041)]):
        start=wrist+direction*.055+tangent*offset
        mid=start+direction*length*.53+Vector((0,-.003,0))
        tip=start+direction*length+Vector((0,-.009,0))
        pts=[tuple(start),tuple(start.lerp(mid,.5)),tuple(mid),tuple(mid.lerp(tip,.5)),tuple(tip)]
        rr=[.007,.0073,.0065,.0058,.0025]
        name=f'finger{f+1}.{side}'
        joint_locations[name]=(start,mid,tip)
        def fw(v,start=start,tip=tip,name=name):
            t=max(0,min(1,(Vector(v)-start).dot(tip-start)/(tip-start).length_squared))
            f=max(0,min(1,(t-.35)/.35))
            return {name+'.01':1-f,name+'.02':f}
        sweep('Finger '+str(f+1)+'.'+side,pts,rr,[r*.80 for r in rr],skin,fw,n=16)
    start=wrist+direction*.018-tangent*.022
    mid=start+direction*.022-tangent*.017+Vector((0,-.004,0))
    tip=mid+direction*.019-tangent*.009+Vector((0,-.008,0))
    name='thumb.'+side;joint_locations[name]=(start,mid,tip)
    sweep('Thumb.'+side,[tuple(start),tuple(start.lerp(mid,.5)),tuple(mid),tuple(mid.lerp(tip,.5)),tuple(tip)],
          [.012,.011,.009,.007,.003],[.01,.009,.007,.006,.003],skin,name+'.01',n=20)

# Pelvic trouser bridge and looped leg surfaces; loose cloth tapers into the boots.
loft('Cargo waist and seat',[(.79,0,.012,.109,.066),(.85,0,.014,.132,.079),
      (.90,0,.012,.139,.083),(.94,0,.010,.133,.079),(.959,0,.010,.130,.078)],pants,weight='pelvis',folds=.006)
for sign,side in [(-1,'R'),(1,'L')]:
    hip=Vector((sign*.082,.008,.871));knee=Vector((sign*.093,-.006,.493));ankle=Vector((sign*.10,.009,.145))
    joint_locations['leg.'+side]=(hip,knee,ankle)
    leg_knots=[(.145,.043,.040),(.20,.047,.045),(.27,.055,.053),(.37,.065,.06),
               (.445,.07,.065),(.495,.071,.065),(.56,.076,.071),(.67,.085,.076),
               (.79,.078,.074),(.85,.073,.073),(.90,.069,.070),(.946,.063,.064)]
    rings=[]
    for z in np.linspace(.145,.946,65):
        rx,ry=interp(z,leg_knots)
        cx=sign*(.10-.031*(z-.145)/.801)
        cy=.008-.013*exp(-((z-.49)/.10)**2)
        fold=.0012*sin(z*60)*exp(-((z-.46)/.07)**2)+.0012*sin(z*100)*exp(-((z-.23)/.04)**2)
        rings.append((z,cx,cy,rx+fold,ry+fold))

    def leg_weight(v,side=side):
        t=max(0,min(1,(v.z-.44)/.11))
        return {'thigh.'+side:t,'shin.'+side:1-t}

    loft('Cargo leg.'+side,rings,pants,n=48,weight=leg_weight,folds=.008)
    # Angled bellows cargo pockets on the outside of the thigh.
    outline=[(sign*.157,-.045,.765),(sign*.170,-.022,.755),(sign*.169,-.02,.650),
             (sign*.147,-.050,.638),(sign*.119,-.065,.646),(sign*.123,-.063,.757)]
    panel('Bellows cargo pocket.'+side,outline,pants,'thigh.'+side,.009,.005)
    flap=[(sign*.120,-.067,.767),(sign*.165,-.039,.772),(sign*.176,-.025,.745),
          (sign*.147,-.057,.732),(sign*.120,-.068,.741)]
    panel('Cargo pocket flap.'+side,flap,cloth,'thigh.'+side,.006,.003)
    line('Cargo topstitch.'+side,[(x,y-.002,z) for x,y,z in outline+[outline[0]]],.00065,cloth,'thigh.'+side)
    # Outside seam and reinforced articulated knee contour.
    pts=[(cx+sign*rx*.995,cy,z) for z,cx,cy,rx,ry in rings]
    line('Trouser outside seam.'+side,pts,.0008,cloth,leg_weight)
    pts=[]
    for t in np.linspace(0,1,25):
        x=sign*.094+(t-.5)*.095
        pts.append((x,-.063+.011*abs(2*t-1),.50+.005*cos(pi*(t-.5))))
    line('Knee dart.'+side,pts,.0007,cloth,leg_weight)
    # Boots: separate outsole, welt, shaped vamp, shaft, tongue and lace crossing.
    x=sign*.100
    bootknots=[(.021,0,-.041,.050,.112),(.035,0,-.043,.057,.123),(.060,0,-.044,.056,.124),
               (.075,0,-.042,.055,.121),(.089,0,-.036,.053,.112),(.115,0,-.006,.049,.071),
               (.147,0,.006,.048,.050),(.213,0,.01,.047,.047),(.225,0,.01,.046,.046)]
    bootrings=[(z,x+cx,cy,rx,ry) for z in np.linspace(.06,.225,35) for cx,cy,rx,ry in [interp(z,bootknots)]]
    loft('Boot upper.'+side,bootrings,leather,weight='foot.'+side,n=64,folds=.012)
    loft('Rubber outsole.'+side,[(0,x,-.045,.052,.117),(.008,x,-.045,.058,.126),
          (.031,x,-.045,.058,.126),(.042,x,-.043,.057,.123),(.058,x,-.043,.057,.123)],sole,weight='foot.'+side,n=64)
    loft('Boot welt.'+side,[(.054,x,-.043,.0575,.1235),(.061,x,-.043,.0575,.1235)],rib,weight='foot.'+side,n=64)
    loft('Boot collar.'+side,[(.208,x,.01,.049,.05),(.225,x,.01,.05,.05),(.230,x,.01,.048,.049)],rib,weight='foot.'+side)
    for i in range(5):
        z=.102+i*.021;y=-.066 if i>1 else -.086+i*.01
        line('Lace cross '+str(i)+'.'+side,[(x-.022,y,z),(x+.022,y-.002,z+.011)],.0014,pants,'foot.'+side)
        line('Lace return '+str(i)+'.'+side,[(x+.022,y,z),(x-.022,y-.002,z+.011)],.0014,pants,'foot.'+side)
    # Toe cap seam tracks the shaped vamp rather than a flat rectangular overlay.
    pts=[(x+.052*sin(a),-.043-.122*cos(a),.078) for a in np.linspace(-1.0,1.0,33)]
    line('Toe cap stitch.'+side,pts,.00065,pants,'foot.'+side)


# Replace overlapping trouser block sections with one continuous sewn surface.
# Each leg's medial half closes on a shared curved crotch seam; outer halves
# join the waist ring. This retains purposeful quad loops without a voxel union.
for old in list(meshes):
    if old.name.startswith(('Cargo leg.','Cargo waist and seat')):
        meshes.remove(old);weights.pop(old.name)
        bpy.data.objects.remove(old,do_unlink=True)
pv=[];pu=[];pf=[];lookup={}


def pants_vertex(co,uv):
    key=tuple(round(float(c),7) for c in co)
    if key not in lookup:
        lookup[key]=len(pv);pv.append(co);pu.append(uv)
    return lookup[key]


for sign in (-1,1):
    loops=[]
    for z in np.linspace(.145,.77,57):
        rx,ry=interp(z,leg_knots)
        cx=sign*(.10-.031*(z-.145)/.801)
        cy=.008-.013*exp(-((z-.49)/.10)**2)
        fold=.0012*sin(z*60)*exp(-((z-.46)/.07)**2)+.0012*sin(z*100)*exp(-((z-.23)/.04)**2)
        loop=[]
        for i in range(48):
            a=i/48*2*pi
            loop.append(pants_vertex((cx+(rx+fold)*sin(a),cy-(ry+fold)*cos(a),z),(i/48,z)))
        loops.append(loop)
    # Eight blend loops gradually construct the hip and perineum pattern.
    base=[Vector(pv[i]) for i in loops[-1]]
    for step in range(1,9):
        t=step/8;loop=[]
        for i in range(48):
            a=i/48*2*pi
            outer=sign*sin(a)>=-1e-7
            top=Vector((.132*sin(a) if outer else 0,.012-.080*cos(a),
                        .87 if outer else .87-.075*abs(sin(a))))
            co=base[i].lerp(top,t)
            loop.append(pants_vertex(tuple(co),(i/48,float(co.z))))
        loops.append(loop)
    for a,b in zip(loops,loops[1:]):
        for i in range(48):pf.append((a[i],a[(i+1)%48],b[(i+1)%48],b[i]))
    pf.append(tuple(reversed(loops[0])))
waist=[]
for z in np.linspace(.87,.959,12):
    rx,ry=interp(z,[(.87,.132,.08),(.91,.139,.083),(.94,.133,.079),(.959,.13,.078)])
    loop=[]
    for i in range(48):
        a=i/48*2*pi
        loop.append(pants_vertex((rx*sin(a),.012-ry*cos(a),z),(i/48,z)))
    waist.append(loop)
for a,b in zip(waist,waist[1:]):
    for i in range(48):pf.append((a[i],a[(i+1)%48],b[(i+1)%48],b[i]))
pf.append(tuple(waist[-1]))


def pants_weights(v):
    side='L' if v.x>=0 else 'R'
    thigh=max(0,min(1,(v.z-.44)/.11))
    hip=max(0,min(1,(v.z-.78)/.10))
    return {'pelvis':hip,'thigh.'+side:thigh*(1-hip),'shin.'+side:(1-thigh)*(1-hip)}


mesh('Cargo trousers — continuous crotch and waist topology',pv,pf,pants,pu,pants_weights)

# Deformation skeleton: explicit joints, fingers and named NLA idle.
armdata=bpy.data.armatures.new('Bebben · deform skeleton')
arm=bpy.data.objects.new('Bebben_Rig',armdata)
export.objects.link(arm)
bpy.context.view_layer.objects.active=arm;arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')


def bone(name,head,tail,parent=None):
    b=armdata.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=armdata.edit_bones[parent]
    return b


bone('root',(0,0,0),(0,0,.12))
bone('pelvis',(0,.008,.87),(0,.008,1.015),'root')
bone('spine',(0,.008,1.015),(0,.008,1.17),'pelvis')
bone('chest',(0,.008,1.17),(0,.012,1.313),'spine')
bone('neck',(0,.012,1.313),(0,.012,1.414),'chest')
bone('head',(0,.012,1.414),(0,.012,1.70),'neck')
for side in ('L','R'):
    sign=1 if side=='L' else -1
    sh,el,wr,ha=joint_locations[side]
    bone('clavicle.'+side,(sign*.024,.008,1.286),sh,'chest')
    bone('upper_arm.'+side,sh,el,'clavicle.'+side)
    bone('forearm.'+side,el,wr,'upper_arm.'+side)
    bone('hand.'+side,wr,ha,'forearm.'+side)
    for key in [f'finger{i}.{side}' for i in range(1,5)]+['thumb.'+side]:
        a,b,c=joint_locations[key]
        bone(key+'.01',a,b,'hand.'+side);bone(key+'.02',b,c,key+'.01')
    h,k,a=joint_locations['leg.'+side]
    bone('thigh.'+side,h,k,'pelvis');bone('shin.'+side,k,a,'thigh.'+side)
    bone('foot.'+side,a,(sign*.1,-.137,.056),'shin.'+side)
    bone('toe.'+side,(sign*.1,-.137,.056),(sign*.1,-.171,.04),'foot.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
arm.show_in_front=True
armdata.display_type='OCTAHEDRAL'
for o in meshes:
    w=weights[o.name]
    groups={}
    for v in o.data.vertices:
        vals=w(v.co) if callable(w) else {w:1}
        total=sum(vals.values())
        for k,f in vals.items():
            if f<1e-6:continue
            if k not in groups:groups[k]=o.vertex_groups.new(name=k)
            groups[k].add([v.index],f/total,'REPLACE')
    mod=o.modifiers.new('Bebben skin — normalized authored weights','ARMATURE');mod.object=arm
    # glTF skinned nodes stay roots; the skin modifier references the skeleton.

# Source animation uses subtle breathing, coordinated shoulder and head arcs.
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=121
arm.animation_data_create()
action=bpy.data.actions.new('Bebben / breathing idle')
arm.animation_data.action=action
for frame in range(1,122,5):
    t=(frame-1)/120*2*pi
    for name in ('spine','chest','neck','head','upper_arm.L','upper_arm.R','forearm.L','forearm.R'):
        b=arm.pose.bones[name];b.rotation_mode='XYZ'
        if name=='spine':b.rotation_euler=(.006*sin(t),0,.003*sin(t))
        elif name=='chest':b.rotation_euler=(-.010*sin(t),0,-.003*sin(t))
        elif name=='neck':b.rotation_euler=(.004*sin(t),0,0)
        elif name=='head':b.rotation_euler=(.006*sin(t),.008*sin(t),.008*(cos(t)-1))
        elif name.startswith('upper_arm'):b.rotation_euler=(.010*sin(t+.3),0,.007*sin(t))
        else:b.rotation_euler=(.008*sin(t+.5),0,0)
        b.keyframe_insert('rotation_euler',frame=frame,group=name)
track=arm.animation_data.nla_tracks.new();track.name='idle'
track.strips.new('idle',1,action);arm.animation_data.action=None
for b in arm.pose.bones:b.matrix_basis.identity()

# Useful editable pose-library actions kept outside NLA/exported idle contract.
def pose_action(name,pose):
    a=bpy.data.actions.new(name);a.use_fake_user=True
    arm.animation_data.action=a
    for b in arm.pose.bones:b.matrix_basis.identity()
    for bn,rot in pose.items():
        b=arm.pose.bones[bn];b.rotation_mode='XYZ';b.rotation_euler=rot
        b.keyframe_insert('rotation_euler',frame=1,group=bn)
    arm.animation_data.action=None
    for b in arm.pose.bones:b.matrix_basis.identity()


pose_action('QA / elbow and shoulder',{'upper_arm.L':(.25,0,-.75),'forearm.L':(1.15,0,0)})
pose_action('QA / high step',{'thigh.L':(-.7,0,0),'shin.L':(1.1,0,0),'foot.L':(-.35,0,0)})
pose_action('QA / torso twist',{'spine':(0,.30,0),'chest':(0,.25,0)})
pose_action('QA / crouch',{'thigh.L':(-.5,0,0),'thigh.R':(-.5,0,0),'shin.L':(1.0,0,0),
                          'shin.R':(1.0,0,0),'chest':(.2,0,0)})
pose_action('QA / fist', {f'finger{i}.{s}.{j}':(.75,0,0) for i in range(1,5) for s in ('L','R') for j in ('01','02')})

# Clean source presentation and portable metadata. No workstation paths in text.
scene.world=bpy.data.worlds.new('Bebben studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.085,.10,.13,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for name,location,energy,size in [('Soft key',(-3,-4,5),550,4),('Fill',(3,-2,3),350,3),('Rim',(1,3,4),650,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);studio.objects.link(o);o.location=location
    o.rotation_euler=(Vector((0,0,1.0))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Portrait studio camera');cam=bpy.data.objects.new(d.name,d);studio.objects.link(cam)
cam.location=(2.6,-4.6,2.0);target=Vector((0,0,.93));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
d.type='ORTHO';d.ortho_scale=2.10;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=48
scene.view_settings.view_transform='Standard'
scene.render.resolution_x=1536;scene.render.resolution_y=1536;scene.render.resolution_percentage=100
scene['Character']='Bebben — original TANGER character'
scene['Creator']='BZ110 / TANGER'
scene['Authoring']='Editable shaped quad surfaces; original UV artwork; named blink and smile keys; normalized skin weights.'
scene['Runtime limitations']='Portable PBR baseline; no spring bones, face SDF, cloth dynamics or gameplay integration.'
scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
face.select_set(True);bpy.context.view_layer.objects.active=face
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.type='MATERIAL'
            area.spaces.active.region_3d.view_distance=2.6
            area.spaces.active.region_3d.view_location=(0,0,1.1)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bebben.blend'))
print('Bebben source saved; original surfaces:',len(meshes))
