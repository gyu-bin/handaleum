#!/usr/bin/env python3
"""Slice assets/stamps/sido/_sheet.png into 17 PNG stamps."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/stamps/sido/_sheet.png"
OUT = ROOT / "assets/stamps/sido"
SLUGS = ["seoul","busan","daegu","incheon","gwangju","daejeon","ulsan","sejong","gyeonggi","gangwon","chungbuk","chungnam","jeonbuk","jeonnam","gyeongbuk","gyeongnam","jeju"]
BOXES = [(28,64,177,215),(190,64,340,215),(352,64,503,215),(516,64,667,215),(680,64,830,215),(843,64,995,215),(28,246,176,398),(189,246,339,398),(353,246,503,398),(516,246,667,398),(681,246,832,398),(845,246,994,398),(90,434,242,588),(260,434,415,588),(431,434,586,588),(602,434,760,588),(776,434,929,588)]
CREAM=(251,247,238); THR=30; PAD=6; SIZE=512

def is_cream(c):
    r,g,b,a=c
    return a<8 or (abs(r-CREAM[0])<=THR and abs(g-CREAM[1])<=THR and abs(b-CREAM[2])<=THR)

def main():
    im=Image.open(SRC).convert("RGBA"); w,h=im.size
    for slug,(x0,y0,x1,y1) in zip(SLUGS,BOXES,strict=True):
        cx,cy=(x0+x1)/2,(y0+y1)/2; half=max(x1-x0,y1-y0)/2+PAD
        left,top=max(0,int(cx-half)),max(0,int(cy-half))
        right,bottom=min(w,int(cx+half)),min(h,int(cy+half))
        crop=im.crop((left,top,right,bottom)).convert("RGBA"); px=crop.load(); cw,ch=crop.size
        r=min(cw,ch)/2-1; ox,oy=cw/2,ch/2
        for y in range(ch):
            for x in range(cw):
                p=px[x,y]; dx,dy=x+.5-ox,y+.5-oy
                if dx*dx+dy*dy>r*r or is_cream(p): px[x,y]=(0,0,0,0)
        side=max(cw,ch); sq=Image.new("RGBA",(side,side),(0,0,0,0))
        sq.paste(crop,((side-cw)//2,(side-ch)//2))
        sq.resize((SIZE,SIZE),Image.Resampling.LANCZOS).save(OUT/f"{slug}.png",optimize=True)
        print(slug)

if __name__=="__main__": main()
