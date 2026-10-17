// Small field-based JSON codec shared by Unity player and CLI parity tests.
// Does not depend on Unity JsonUtility, dynamic code generation, JavaScript, or NuGet.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;

namespace ElementHabitat
{
    public static class NativeJson
    {
        public static string Serialize(object value) { var buffer=new StringBuilder();Write(buffer,value,0);return buffer.ToString(); }
        public static object Parse(string json) { if(json==null)throw new ArgumentNullException("json");return new Parser(json).ReadDocument(); }
        public static T Deserialize<T>(string json) { return (T)ConvertValue(Parse(json),typeof(T)); }
        public static object ConvertValue(object value,Type target)
        {
            if(value==null){if(target.IsValueType&&Nullable.GetUnderlyingType(target)==null)throw new FormatException("Null numeric value");return null;}
            if(target==typeof(object))return value;
            if(target==typeof(string)){if(!(value is string))throw new FormatException("Expected string");return value;}
            if(target==typeof(bool)){if(!(value is bool))throw new FormatException("Expected boolean");return value;}
            if(target.IsPrimitive||target==typeof(decimal))return Convert.ChangeType(value,target,CultureInfo.InvariantCulture);
            if(target.IsArray){var list=value as List<object>;if(list==null)throw new FormatException("Expected array");var array=Array.CreateInstance(target.GetElementType(),list.Count);for(int i=0;i<list.Count;i++)array.SetValue(ConvertValue(list[i],target.GetElementType()),i);return array;}
            if(typeof(IDictionary).IsAssignableFrom(target)){
                var source=value as Dictionary<string,object>;if(source==null)throw new FormatException("Expected dictionary");
                var result=(IDictionary)Activator.CreateInstance(target);result.Clear();Type type=target;
                while(!type.IsGenericType&&type.BaseType!=null)type=type.BaseType;
                var arguments=type.GetGenericArguments();if(arguments.Length!=2||arguments[0]!=typeof(string))throw new FormatException("Only string dictionary keys supported");
                foreach(var item in source)result[item.Key]=ConvertValue(item.Value,arguments[1]);return result;
            }
            if(typeof(IList).IsAssignableFrom(target)){
                var source=value as List<object>;if(source==null)throw new FormatException("Expected list");var list=(IList)Activator.CreateInstance(target);Type itemType=target.GetGenericArguments()[0];
                foreach(var item in source)list.Add(ConvertValue(item,itemType));return list;
            }
            var map=value as Dictionary<string,object>;if(map==null)throw new FormatException("Expected object");
            object instance=Activator.CreateInstance(target,true);
            foreach(var field in target.GetFields(BindingFlags.Instance|BindingFlags.Public)){object raw;if(map.TryGetValue(field.Name,out raw))field.SetValue(instance,ConvertValue(raw,field.FieldType));}
            return instance;
        }
        private static void Write(StringBuilder buffer,object value,int depth)
        {
            if(depth>256)throw new FormatException("JSON nesting limit");if(value==null){buffer.Append("null");return;}
            if(value is string){Quote(buffer,(string)value);return;}if(value is bool){buffer.Append((bool)value?"true":"false");return;}
            if(value is char){Quote(buffer,value.ToString());return;}var type=value.GetType();
            if(type.IsPrimitive||value is decimal){string numeric=Convert.ToString(value,CultureInfo.InvariantCulture);if(numeric=="NaN"||numeric=="Infinity"||numeric=="-Infinity")throw new FormatException("Non-finite number");buffer.Append(numeric);return;}
            var dictionary=value as IDictionary;if(dictionary!=null){buffer.Append('{');bool first=true;foreach(DictionaryEntry item in dictionary){if(!first)buffer.Append(',');first=false;Quote(buffer,(string)item.Key);buffer.Append(':');Write(buffer,item.Value,depth+1);}buffer.Append('}');return;}
            var list=value as IEnumerable;if(list!=null){buffer.Append('[');bool first=true;foreach(var item in list){if(!first)buffer.Append(',');first=false;Write(buffer,item,depth+1);}buffer.Append(']');return;}
            buffer.Append('{');bool initial=true;
            foreach(var field in type.GetFields(BindingFlags.Instance|BindingFlags.Public)){if(!initial)buffer.Append(',');initial=false;Quote(buffer,field.Name);buffer.Append(':');Write(buffer,field.GetValue(value),depth+1);}buffer.Append('}');
        }
        private static void Quote(StringBuilder buffer,string value)
        {
            buffer.Append('"');foreach(char c in value){switch(c){case '"':buffer.Append("\\\"");break;case '\\':buffer.Append("\\\\");break;case '\b':buffer.Append("\\b");break;case '\f':buffer.Append("\\f");break;case '\n':buffer.Append("\\n");break;case '\r':buffer.Append("\\r");break;case '\t':buffer.Append("\\t");break;default:if(c<32)buffer.Append("\\u"+((int)c).ToString("x4",CultureInfo.InvariantCulture));else buffer.Append(c);break;}}buffer.Append('"');
        }
        private sealed class Parser
        {
            private readonly string source;private int at;
            public Parser(string source){this.source=source;}
            public object ReadDocument(){object value=Read(0);Space();if(at!=source.Length)throw new FormatException("Trailing JSON");return value;}
            private void Space(){while(at<source.Length&&char.IsWhiteSpace(source[at]))at++;}
            private char Take(){if(at>=source.Length)throw new FormatException("Unexpected end of JSON");return source[at++];}
            private bool Consume(char c){Space();if(at<source.Length&&source[at]==c){at++;return true;}return false;}
            private object Read(int depth)
            {
                if(depth>256)throw new FormatException("JSON nesting limit");Space();if(at>=source.Length)throw new FormatException("Missing JSON value");char c=source[at];
                if(c=='"')return String();if(c=='{')return Object(depth+1);if(c=='[')return Array(depth+1);
                if(c=='t'){Literal("true");return true;}if(c=='f'){Literal("false");return false;}if(c=='n'){Literal("null");return null;}return Number();
            }
            private void Literal(string value){if(source.Length-at<value.Length||source.Substring(at,value.Length)!=value)throw new FormatException("Bad JSON literal");at+=value.Length;}
            private string String()
            {
                if(Take()!='"')throw new FormatException("Expected string");var buffer=new StringBuilder();
                while(true){char c=Take();if(c=='"')return buffer.ToString();if(c<32)throw new FormatException("Control character in JSON string");if(c!='\\'){buffer.Append(c);continue;}
                    c=Take();switch(c){case '"':case '\\':case '/':buffer.Append(c);break;case 'b':buffer.Append('\b');break;case 'f':buffer.Append('\f');break;case 'n':buffer.Append('\n');break;case 'r':buffer.Append('\r');break;case 't':buffer.Append('\t');break;case 'u':
                        if(source.Length-at<4)throw new FormatException("Incomplete Unicode escape");buffer.Append((char)int.Parse(source.Substring(at,4),NumberStyles.HexNumber,CultureInfo.InvariantCulture));at+=4;break;
                        default:throw new FormatException("Invalid string escape");}}
            }
            private Dictionary<string,object> Object(int depth)
            {
                Take();var result=new Dictionary<string,object>();if(Consume('}'))return result;
                while(true){Space();string key=String();if(!Consume(':'))throw new FormatException("Expected colon");result.Add(key,Read(depth));if(Consume('}'))return result;if(!Consume(','))throw new FormatException("Expected comma");}
            }
            private List<object> Array(int depth)
            {
                Take();var result=new List<object>();if(Consume(']'))return result;while(true){result.Add(Read(depth));if(Consume(']'))return result;if(!Consume(','))throw new FormatException("Expected comma");}
            }
            private object Number()
            {
                int begin=at;if(at<source.Length&&source[at]=='-')at++;
                if(at>=source.Length||source[at]<'0'||source[at]>'9')throw new FormatException("Bad JSON number");
                if(source[at]=='0')at++;else while(at<source.Length&&char.IsDigit(source[at]))at++;
                bool real=false;
                if(at<source.Length&&source[at]=='.'){real=true;at++;int start=at;while(at<source.Length&&char.IsDigit(source[at]))at++;if(start==at)throw new FormatException("Missing fraction");}
                if(at<source.Length&&(source[at]=='e'||source[at]=='E')){real=true;at++;if(at<source.Length&&(source[at]=='+'||source[at]=='-'))at++;int start=at;while(at<source.Length&&char.IsDigit(source[at]))at++;if(start==at)throw new FormatException("Missing exponent");}
                string token=source.Substring(begin,at-begin);if(!real)return long.Parse(token,CultureInfo.InvariantCulture);
                double value=double.Parse(token,CultureInfo.InvariantCulture);if(double.IsNaN(value)||double.IsInfinity(value))throw new FormatException("Non-finite JSON number");return value;
            }
        }
    }
}
