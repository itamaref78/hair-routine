from PIL import Image, ImageDraw
import math
def draw(size, maskable=False):
    S=size*4
    im=Image.new('RGBA',(S,S),(15,23,42,255))
    d=ImageDraw.Draw(im)
    # radial glow
    glow=Image.new('RGBA',(S,S),(0,0,0,0)); g=ImageDraw.Draw(glow)
    for i in range(60,0,-1):
        r=S*0.5*i/60
        a=int(70*(1-i/60))
        g.ellipse([S*0.5-r,S*0.45-r,S*0.5+r,S*0.45+r],fill=(16,185,129,a))
    im=Image.alpha_composite(im,glow); d=ImageDraw.Draw(im)
    k = 0.62 if maskable else 0.78
    cx,cy=S/2,S/2
    R=S*k/2
    d.ellipse([cx-R,cy-R,cx+R,cy+R],outline=(245,158,11,255),width=int(S*0.014))
    # leaf
    def leaf(cx,cy,w,h,ang,col):
        pts=[]
        for t in range(0,101):
            u=t/100*math.pi
            x=math.sin(u)*w/2; y=-math.cos(u)*h/2
            pts.append((x,y))
        pts2=[(-x,y) for x,y in reversed(pts)]
        poly=pts+pts2
        c,s=math.cos(ang),math.sin(ang)
        poly=[(cx+x*c-y*s,cy+x*s+y*c) for x,y in poly]
        d.polygon(poly,fill=col)
    u=R
    leaf(cx,cy-u*0.05,u*0.62,u*1.25,0,(16,185,129,255))
    leaf(cx-u*0.42,cy+u*0.05,u*0.36,u*0.8,-0.9,(5,150,105,255))
    leaf(cx+u*0.42,cy+u*0.05,u*0.36,u*0.8,0.9,(52,211,153,255))
    d.line([cx,cy+u*0.62,cx,cy-u*0.45],fill=(15,23,42,255),width=int(S*0.012))
    # gold drop
    dr=u*0.13
    d.ellipse([cx-dr,cy+u*0.58-dr,cx+dr,cy+u*0.58+dr],fill=(245,158,11,255))
    return im.resize((size,size),Image.LANCZOS).convert('RGB')
draw(192).save('icons/icon-192.png');draw(512).save('icons/icon-512.png')
draw(512,True).save('icons/maskable-512.png');draw(180).save('icons/apple-touch-icon.png')
draw(96).save('icons/icon-96.png')
