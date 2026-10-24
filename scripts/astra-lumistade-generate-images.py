#!/usr/bin/env python3
"""ASTRA IMAGE INTEGRITY Ω. Original 1600x900 editorial illustrations, not Lumistade product photos."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from hashlib import sha256
from math import sin, cos, pi

ROOT=Path("public/blog/discover/lumistade")
ROOT.mkdir(parents=True,exist_ok=True)
W,H=1600,900
SCENES=[
 ("lumistade-presentation",0,"room",(48,191,223)),
 ("lumistade-avis",1,"inspect",(149,199,230)),
 ("lumistade-prix-livraison",2,"parcel",(249,185,106)),
 ("lumistade-psg-om",3,"dual",(99,166,239)),
 ("lumistade-cadeau",4,"gift",(188,139,239)),
 ("lumistade-presentation-detail",5,"rim",(83,234,230)),
 ("lumistade-avis-controle",6,"check",(139,216,224)),
 ("lumistade-prix-comparatif",7,"receipt",(231,191,126)),
 ("lumistade-stades-architecture",8,"architecture",(118,175,236)),
 ("lumistade-cadeau-deco",9,"framed",(220,144,202)),
]
def mix(a,b,t):return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
def base(i,accent):
    room=[(28,39,52),(34,40,54),(54,42,40),(25,38,61),(55,36,53)][i%5]
    im=Image.new("RGBA",(W,H))
    d=ImageDraw.Draw(im)
    for y in range(H):
       p=y/H
       d.line((0,y,W,y),fill=(*mix(room,accent,.27*(1-p)+.05),255),width=1)
    d.rectangle((0,810,W,900),fill=(*mix(room,(14,15,19),.45),255))
    d.line((0,810,W,810),fill=(125,121,112,255),width=4)
    return im

def stadium(im,cx,cy,rx,ry,accent):
    # Three-dimensional wall relief with coloured LED accent and detailed stands.
    overlay=Image.new("RGBA",(W,H))
    d=ImageDraw.Draw(overlay)
    d.ellipse((cx-rx+35,cy-ry+45,cx+rx+65,cy+ry+105),fill=(0,0,0,160))
    im.alpha_composite(overlay.filter(ImageFilter.GaussianBlur(35)))
    d=ImageDraw.Draw(im)
    for k in range(15):
        m=15-k
        d.ellipse((cx-rx+m*6,cy-ry+m*3,cx+rx-m*6,cy+ry-m*3),
            fill=(*mix((28,42,59),accent,.10+k/95),255),
            outline=(*mix((116,132,153),accent,.32),255),width=4)
    for k in range(5):
        m=50+k*24
        d.ellipse((cx-rx+m,cy-ry+m*.57,cx+rx-m,cy+ry-m*.57),
            outline=(188,194,203,255),width=5)
    for j in range(120):
        theta=2*pi*j/120
        for m in (62,96,130):
            x=int(cx+(rx-m)*cos(theta));y=int(cy+(ry-m*.56)*sin(theta))
            r=2
            d.ellipse((x-r,y-r,x+r,y+r),fill=(*mix(accent,(218,221,212),.38),255))
    xw,yh=int(rx*.54),int(ry*.54)
    d.rounded_rectangle((cx-xw,cy-yh,cx+xw,cy+yh),radius=8,fill=(25,111,78))
    for i in range(10):
        x=cx-xw+i*2*xw//10
        d.rectangle((x,cy-yh,x+2*xw//10,cy+yh),fill=(32,124,90) if i%2 else (28,106,77))
    d.rectangle((cx-xw,cy-yh,cx+xw,cy+yh),outline=(221,230,217),width=3)
    d.line((cx,cy-yh,cx,cy+yh),fill=(224,235,218),width=3)
    d.ellipse((cx-44,cy-30,cx+44,cy+30),outline=(228,238,224),width=3)
    for side in (-1,1):
        xx=cx+side*xw
        if side<0:d.rectangle((xx,cy-40,xx+int(xw*.18),cy+40),outline=(235,239,225),width=3)
        else:d.rectangle((xx-int(xw*.18),cy-40,xx,cy+40),outline=(235,239,225),width=3)
    ring=(cx-rx+18,cy-ry+11,cx+rx-18,cy+ry-10)
    halo=Image.new("RGBA",(W,H))
    hd=ImageDraw.Draw(halo)
    hd.ellipse(ring,outline=(*accent,170),width=22)
    im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(31)))
    ImageDraw.Draw(im).ellipse(ring,outline=(*accent,255),width=7)
    return im

def draw_scene(slug,i,scene,accent):
    im=base(i,accent);d=ImageDraw.Draw(im)
    if scene in ("room","rim"):
        d.rounded_rectangle((100,690,360,719),radius=8,fill=(118,92,73))
        d.rectangle((152,719,174,838),fill=(60,53,49));d.rectangle((310,719,333,836),fill=(60,53,49))
        for x in (130,188,247):
            d.rectangle((x,620,x+47,686),fill=(44,49,61),outline=(154,133,102),width=3)
        im=stadium(im,860,405,490 if scene=="room" else 560,300 if scene=="room" else 350,accent)
    elif scene=="inspect":
        d.rounded_rectangle((160,730,1450,860),radius=20,fill=(133,94,75))
        im=stadium(im,750,430,400,255,accent)
        d=ImageDraw.Draw(im)
        d.ellipse((1110,115,1480,485),outline=(238,215,175),width=21)
        d.line((1370,485,1530,700),fill=(238,215,175),width=30)
    elif scene=="parcel":
        d.polygon(((100,380),(350,300),(630,400),(380,510)),fill=(205,159,108))
        d.polygon(((100,380),(380,510),(380,805),(100,687)),fill=(168,124,89))
        d.polygon(((380,510),(630,400),(630,683),(380,805)),fill=(128,96,74))
        d.line((230,340,510,458),fill=(245,224,189),width=20)
        im=stadium(im,1130,420,360,265,accent)
    elif scene=="dual":
        im=stadium(im,485,436,385,278,(79,159,243))
        im=stadium(im,1130,432,350,265,(234,107,119))
        ImageDraw.Draw(im).line((805,180,805,760),fill=(209,203,197),width=6)
    elif scene=="gift":
        d.rounded_rectangle((145,550,605,815),radius=22,fill=(234,187,130))
        d.rectangle((335,551,382,813),fill=(160,71,101))
        d.rectangle((145,652,605,696),fill=(160,71,101))
        d.ellipse((290,500,351,560),outline=(175,77,101),width=19)
        d.ellipse((369,500,432,560),outline=(175,77,101),width=19)
        im=stadium(im,1080,395,380,270,accent)
    elif scene=="check":
        d.rounded_rectangle((135,210,485,660),radius=24,fill=(227,231,224))
        for j in range(5):
            y=277+j*70
            d.ellipse((185,y,218,y+33),fill=(68,169,158))
            d.rounded_rectangle((242,y+8,429,y+22),radius=8,fill=(103,124,129))
        im=stadium(im,1040,425,400,260,accent)
    elif scene=="receipt":
        d.rounded_rectangle((150,190,670,725),radius=24,fill=(226,222,206))
        for j in range(8):
            y=275+j*53
            d.rounded_rectangle((214,y,578,y+18),radius=8,fill=(118,128,129) if j<3 else (181,183,171))
        im=stadium(im,1130,430,390,262,accent)
    elif scene=="architecture":
        im=stadium(im,510,455,475,320,(90,169,247))
        im=stadium(im,1157,367,353,252,(236,126,130))
        d=ImageDraw.Draw(im)
        for j in range(4):d.line((820,680+j*18,1195,680+j*18),fill=(188,179,169),width=3)
    elif scene=="framed":
        d.rectangle((108,300,439,746),fill=(58,63,76),outline=(232,194,155),width=14)
        d.rectangle((146,339,395,690),fill=(147,115,129))
        d.ellipse((180,420,358,581),outline=(246,209,152),width=21)
        im=stadium(im,1050,397,425,305,accent)
    else:
        im=stadium(im,800,420,455,285,accent)
    out=ROOT/(slug+".jpg")
    im.convert("RGB").save(out,"JPEG",quality=88,optimize=True,progressive=True,subsampling=0)
    return sha256(out.read_bytes()).hexdigest()

hashes=[]
for spec in SCENES:hashes.append(draw_scene(*spec))
assert len(SCENES)==10 and len(set(hashes))==10
for slug,*_ in SCENES:
    file=ROOT/(slug+".jpg")
    with Image.open(file) as image: assert image.size==(1600,900) and image.format=="JPEG"
print("ASTRA_LUMISTADE_IMAGES_PASS count=10 width=1600 height=900 sha_unique=10")
