using System.Collections.Generic;
using UnityEngine;

namespace ElementHabitat
{
    // Smooth unions give each cloud one continuous surface, instead of intersecting spheres.
    internal static class HabitatCloudMesh
    {
        struct Sample { public Vector3 p; public float d; public Sample(Vector3 p, float d) { this.p=p; this.d=d; } }
        static readonly Vector4[] Lobes = {
            new Vector4(-.05f,-.22f,0,1.02f), new Vector4(-.9f,.05f,.02f,.60f),
            new Vector4(-.28f,.32f,-.04f,.76f), new Vector4(.52f,.16f,.04f,.66f),
            new Vector4(1.03f,-.07f,.01f,.46f), new Vector4(-.55f,-.12f,.42f,.43f),
            new Vector4(.38f,-.15f,-.38f,.46f)
        };
        static float Field(Vector3 p, int variant)
        {
            float d=10;
            for(int i=0;i<Lobes.Length;i++) {
                Vector4 l=Lobes[i];
                Vector3 q=p-new Vector3(l.x,l.y+(i%2==0?variant*.028f:-variant*.018f),l.z);
                Vector3 scale=i==0?new Vector3(1.35f,.43f,.63f):new Vector3(l.w,l.w*.91f,l.w*.94f);
                q=new Vector3(q.x/scale.x,q.y/scale.y,q.z/scale.z);
                float v=(q.magnitude-1)*Mathf.Min(scale.x,Mathf.Min(scale.y,scale.z));
                float h=Mathf.Max(.18f-Mathf.Abs(d-v),0)/.18f;
                d=Mathf.Min(d,v)-h*h*.045f;
            }
            return d;
        }
        static Vector3 Normal(Vector3 p,int variant)
        {
            const float e=.007f;
            return new Vector3(Field(p+Vector3.right*e,variant)-Field(p-Vector3.right*e,variant),
                Field(p+Vector3.up*e,variant)-Field(p-Vector3.up*e,variant),
                Field(p+Vector3.forward*e,variant)-Field(p-Vector3.forward*e,variant)).normalized;
        }
        static Vector3 Edge(Sample a,Sample b) { return Vector3.LerpUnclamped(a.p,b.p,a.d/(a.d-b.d)); }
        public static Mesh Create(int variant)
        {
            const int nx=20,ny=12,nz=12;
            var grid=new Sample[(nx+1)*(ny+1)*(nz+1)];
            int Id(int x,int y,int z) { return (z*(ny+1)+y)*(nx+1)+x; }
            for(int z=0;z<=nz;z++) for(int y=0;y<=ny;y++) for(int x=0;x<=nx;x++) {
                Vector3 p=new Vector3(-1.75f+x*3.5f/nx,-.85f+y*2.05f/ny,-1+z*2f/nz);
                grid[Id(x,y,z)]=new Sample(p,Field(p,variant));
            }
            var vertices=new List<Vector3>(); var normals=new List<Vector3>(); var colors=new List<Color>(); var indices=new List<int>();
            var weld=new Dictionary<Vector3Int,int>();
            void Triangle(Vector3 a,Vector3 b,Vector3 c) {
                if(Vector3.Dot(Vector3.Cross(b-a,c-a),Normal((a+b+c)/3,variant))<0) { var t=b;b=c;c=t; }
                foreach(var p in new[]{a,b,c}) {
                    var key=new Vector3Int(Mathf.RoundToInt(p.x*100000),Mathf.RoundToInt(p.y*100000),Mathf.RoundToInt(p.z*100000));
                    if(!weld.TryGetValue(key,out int index)) {
                        index=vertices.Count; weld.Add(key,index); vertices.Add(p); Vector3 n=Normal(p,variant); normals.Add(n);
                        float shade=Mathf.Clamp01(Vector3.Dot(n,new Vector3(-.3f,.9f,-.2f).normalized)*.55f+.5f);
                        colors.Add(Color.Lerp(new Color(.72f,.83f,.91f),new Color(1,.99f,.96f),shade));
                    }
                    indices.Add(index);
                }
            }
            int[,] tetra={{0,5,1,6},{0,1,2,6},{0,2,3,6},{0,3,7,6},{0,7,4,6},{0,4,5,6}};
            for(int z=0;z<nz;z++) for(int y=0;y<ny;y++) for(int x=0;x<nx;x++) {
                Sample[] cube={grid[Id(x,y,z)],grid[Id(x+1,y,z)],grid[Id(x+1,y+1,z)],grid[Id(x,y+1,z)],grid[Id(x,y,z+1)],grid[Id(x+1,y,z+1)],grid[Id(x+1,y+1,z+1)],grid[Id(x,y+1,z+1)]};
                for(int t=0;t<6;t++) {
                    var inside=new List<Sample>(4); var outside=new List<Sample>(4);
                    for(int k=0;k<4;k++) { var s=cube[tetra[t,k]];if(s.d<0)inside.Add(s);else outside.Add(s); }
                    if(inside.Count==1) Triangle(Edge(inside[0],outside[0]),Edge(inside[0],outside[1]),Edge(inside[0],outside[2]));
                    else if(inside.Count==3) Triangle(Edge(outside[0],inside[0]),Edge(outside[0],inside[1]),Edge(outside[0],inside[2]));
                    else if(inside.Count==2) {
                        Vector3 u=Edge(inside[0],outside[0]),v=Edge(inside[0],outside[1]),w=Edge(inside[1],outside[0]),q=Edge(inside[1],outside[1]);
                        Triangle(u,v,w);Triangle(v,q,w);
                    }
                }
            }
            var mesh=new Mesh { name="Rounded cloud "+variant };
            mesh.SetVertices(vertices);mesh.SetNormals(normals);mesh.SetColors(colors);mesh.SetTriangles(indices,0);mesh.RecalculateBounds();return mesh;
        }
    }
}
