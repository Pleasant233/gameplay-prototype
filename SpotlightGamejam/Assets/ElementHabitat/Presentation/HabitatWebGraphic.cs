using UnityEngine;
using UnityEngine.UI;

namespace ElementHabitat
{
    /// <summary>Small original UGUI illustrations replace browser emoji without a runtime font dependency.</summary>
    [RequireComponent(typeof(CanvasRenderer))]
    public sealed class HabitatWebGraphic : MaskableGraphic
    {
        public string Kind, Family;
        VertexHelper mesh;
        Rect area;
        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();mesh=vh;area=rectTransform.rect;
            if(Kind=="gloss"){Gradient(new Color(1,1,1,0),new Color(1,1,1,.32f),.5f,1);return;}
            if(Kind=="terrain")
            {
                Gradient(new Color(0,0,0,.36f),new Color(1,1,1,.28f),0,1);
                var old=area;float s=Mathf.Min(area.width,area.height)*.43f;
                area=new Rect(old.center.x-s*.5f,old.yMin+old.height*.44f,s,s);DrawTerrain(Family);area=old;return;
            }
            switch(Kind)
            {
                case "menu":for(int i=0;i<3;i++)Quad(.08f,.18f+i*.26f,.84f,.1f,color);break;
                case "bag":
                    Ring(new Vector2(.5f,.79f),.19f,.13f,.07f,color);Quad(.22f,.1f,.56f,.65f,color);Quad(.3f,.21f,.4f,.22f,new Color(1,1,1,.35f));Quad(.18f,.36f,.64f,.1f,new Color(1,1,1,.25f));break;
                case "crystal":
                    Polygon(color,new Vector2(.5f,1),new Vector2(.96f,.64f),new Vector2(.79f,0),new Vector2(.21f,0),new Vector2(.04f,.64f));
                    Polygon(new Color(1,1,1,.65f),new Vector2(.5f,.95f),new Vector2(.08f,.64f),new Vector2(.5f,.45f));
                    Polygon(new Color(0,0,0,.13f),new Vector2(.5f,.45f),new Vector2(.92f,.64f),new Vector2(.79f,.04f),new Vector2(.5f,.04f));break;
                case "hourglass":
                    Quad(.17f,.87f,.66f,.1f,color);Quad(.17f,.03f,.66f,.1f,color);
                    Polygon(color,new Vector2(.25f,.85f),new Vector2(.75f,.85f),new Vector2(.56f,.5f),new Vector2(.75f,.15f),new Vector2(.25f,.15f),new Vector2(.44f,.5f));break;
                case "hex":Polygon(color,new Vector2(.5f,.95f),new Vector2(.91f,.72f),new Vector2(.91f,.28f),new Vector2(.5f,.05f),new Vector2(.09f,.28f),new Vector2(.09f,.72f));break;
                case "magic-mine":Polygon(color,new Vector2(.5f,.97f),new Vector2(.97f,.5f),new Vector2(.5f,.03f),new Vector2(.03f,.5f));Polygon(new Color(.7f,.7f,.7f,1),new Vector2(.5f,.79f),new Vector2(.79f,.5f),new Vector2(.5f,.21f),new Vector2(.21f,.5f));break;
                case "magic-spring":Ellipse(new Vector2(.5f,.5f),.46f,.46f,color);Ellipse(new Vector2(.5f,.5f),.31f,.31f,new Color(.7f,.7f,.7f,1));Ellipse(new Vector2(.5f,.5f),.24f,.24f,color);break;
                case "magic-rich":Ring(new Vector2(.5f,.5f),.38f,.38f,.07f,color);Ring(new Vector2(.5f,.5f),.2f,.2f,.06f,color);break;
                case "magic-burn":Polygon(color,new Vector2(.5f,.98f),new Vector2(.95f,.08f),new Vector2(.05f,.08f));break;
                default:Polygon(color,new Vector2(.5f,1),new Vector2(.65f,.65f),new Vector2(1,.5f),new Vector2(.65f,.35f),new Vector2(.5f,0),new Vector2(.35f,.35f),new Vector2(0,.5f),new Vector2(.35f,.65f));break;
            }
        }
        void DrawTerrain(string family)
        {
            Color white=new Color(.97f,.98f,.92f,1);
            switch(family)
            {
                case "woodland":
                    Quad(.44f,.02f,.13f,.4f,new Color(.45f,.3f,.16f));
                    for(int i=0;i<3;i++){float y=.22f+i*.2f;Polygon(new Color(.25f+i*.08f,.58f+i*.06f,.2f),new Vector2(.5f,y+.48f),new Vector2(.1f+i*.06f,y),new Vector2(.9f-i*.06f,y));}break;
                case "grassland":
                    Quad(.47f,.1f,.08f,.58f,new Color(.3f,.5f,.15f));Ellipse(new Vector2(.32f,.54f),.25f,.11f,new Color(.66f,.85f,.25f));Ellipse(new Vector2(.68f,.7f),.25f,.12f,new Color(.8f,.91f,.33f));break;
                case "ice":
                    for(int i=0;i<3;i++){float a=i*Mathf.PI/3;Vector2 d=new Vector2(Mathf.Cos(a),Mathf.Sin(a))*.48f;Line(new Vector2(.5f,.5f)-d,new Vector2(.5f,.5f)+d,.07f,white);}break;
                case "ocean":
                    for(int i=0;i<3;i++){float y=.2f+i*.25f;Line(new Vector2(.05f,y),new Vector2(.32f,y+.1f),.07f,white);Line(new Vector2(.32f,y+.1f),new Vector2(.65f,y),.07f,white);Line(new Vector2(.65f,y),new Vector2(.95f,y+.1f),.07f,white);}break;
                case "river":
                    Polygon(white,new Vector2(.25f,1),new Vector2(.6f,1),new Vector2(.45f,.6f),new Vector2(.75f,.25f),new Vector2(.65f,0),new Vector2(.3f,0),new Vector2(.35f,.3f),new Vector2(.15f,.65f));break;
                case "wetland":
                    Ellipse(new Vector2(.5f,.24f),.48f,.12f,new Color(.3f,.65f,.4f));
                    Ellipse(new Vector2(.5f,.54f),.15f,.32f,white);Ellipse(new Vector2(.31f,.44f),.13f,.26f,white);Ellipse(new Vector2(.69f,.44f),.13f,.26f,white);break;
                case "volcano":case "mine":
                    Polygon(white,new Vector2(.05f,.08f),new Vector2(.37f,.86f),new Vector2(.56f,.61f),new Vector2(.7f,.98f),new Vector2(.97f,.08f));
                    Polygon(new Color(.68f,.72f,.7f,1),new Vector2(.56f,.61f),new Vector2(.7f,.98f),new Vector2(.97f,.08f));break;
                case "desert":
                    Quad(.43f,.06f,.15f,.86f,white);Quad(.15f,.35f,.55f,.14f,white);Quad(.15f,.37f,.14f,.35f,white);Quad(.68f,.49f,.14f,.32f,white);Quad(.53f,.49f,.29f,.14f,white);break;
                case "ruins":
                    Polygon(white,new Vector2(.02f,.7f),new Vector2(.5f,.95f),new Vector2(.98f,.7f));Quad(.07f,.07f,.86f,.1f,white);Quad(.12f,.2f,.15f,.43f,white);Quad(.42f,.2f,.15f,.43f,white);Quad(.72f,.2f,.15f,.43f,white);break;
                default:
                    Ellipse(new Vector2(.5f,.5f),.33f,.33f,white);break;
            }
        }
        Vector2 Point(Vector2 p){return new Vector2(area.xMin+p.x*area.width,area.yMin+p.y*area.height);}
        void Polygon(Color tint,params Vector2[] points)
        {
            int start=mesh.currentVertCount;Vector2 center=Vector2.zero;foreach(var point in points)center+=point;center/=points.Length;
            mesh.AddVert(Point(center),tint,Vector2.zero);foreach(var point in points)mesh.AddVert(Point(point),tint,Vector2.zero);
            for(int i=0;i<points.Length;i++)mesh.AddTriangle(start,start+i+1,start+(i+1)%points.Length+1);
        }
        void Quad(float x,float y,float w,float h,Color tint){Polygon(tint,new Vector2(x,y),new Vector2(x+w,y),new Vector2(x+w,y+h),new Vector2(x,y+h));}
        void Gradient(Color bottom,Color top,float y0,float y1)
        {
            int start=mesh.currentVertCount;mesh.AddVert(Point(new Vector2(0,y0)),bottom,Vector2.zero);mesh.AddVert(Point(new Vector2(1,y0)),bottom,Vector2.zero);mesh.AddVert(Point(new Vector2(1,y1)),top,Vector2.zero);mesh.AddVert(Point(new Vector2(0,y1)),top,Vector2.zero);mesh.AddTriangle(start,start+1,start+2);mesh.AddTriangle(start,start+2,start+3);
        }
        void Ellipse(Vector2 center,float rx,float ry,Color tint)
        {
            var points=new Vector2[24];for(int i=0;i<points.Length;i++){float a=i*Mathf.PI*2/points.Length;points[i]=center+new Vector2(Mathf.Cos(a)*rx,Mathf.Sin(a)*ry);}Polygon(tint,points);
        }
        void Ring(Vector2 center,float rx,float ry,float stroke,Color tint)
        {
            for(int i=0;i<24;i++){float a=i*Mathf.PI*2/24,b=(i+1)*Mathf.PI*2/24;Polygon(tint,center+new Vector2(Mathf.Cos(a)*rx,Mathf.Sin(a)*ry),center+new Vector2(Mathf.Cos(b)*rx,Mathf.Sin(b)*ry),center+new Vector2(Mathf.Cos(b)*(rx-stroke),Mathf.Sin(b)*(ry-stroke)),center+new Vector2(Mathf.Cos(a)*(rx-stroke),Mathf.Sin(a)*(ry-stroke)));}
        }
        void Line(Vector2 a,Vector2 b,float stroke,Color tint){Vector2 d=(b-a).normalized;Vector2 n=new Vector2(-d.y,d.x)*stroke*.5f;Polygon(tint,a+n,b+n,b-n,a-n);}
    }
}
