using System.Text.Json;
using System.Text;
using ElementHabitat;

// Development-only line protocol used by scripts/unity-parity.cjs. Never in a player.
Console.InputEncoding = new UTF8Encoding(false);
Console.OutputEncoding = new UTF8Encoding(false);
var options = new JsonSerializerOptions { IncludeFields = true };
string line;
while ((line = Console.ReadLine()) != null)
{
    try
    {
        var fixture = NativeJson.Deserialize<Fixture>(line);
        State state;
        ActionResult result = null;
        if (fixture.op == "new") state = Game.NewGame(fixture.seed, fixture.tutorial, fixture.mode);
        else
        {
            state = fixture.state;
            if (fixture.op == "restore") state = Game.Restore(fixture.raw);
            else if (fixture.op == "roundtrip") state = Game.Restore(Game.Serialize(state));
            else if (fixture.op == "endless") result = Game.EnterEndless(state);
            else if (fixture.op == "sequence")
            {
                foreach (var action in fixture.actions)
                {
                    result = action.type == "endRound" ? Game.EndRound(state) : action.type == "enterEndless" ? Game.EnterEndless(state) : Game.Apply(state, action);
                    if (!result.ok) throw new Exception("Sequence rejected: " + result.msg);
                    if (fixture.roundtripEach) state = Game.Restore(Game.Serialize(state)) ?? throw new Exception("Native save roundtrip failed");
                }
            }
            else result = fixture.op == "end" ? Game.EndRound(state) : Game.Apply(state, fixture.action);
        }
        Console.WriteLine(JsonSerializer.Serialize(new { state, result, score = state == null ? null : Game.Score(state) }, options));
    }
    catch (Exception e) { Console.WriteLine(JsonSerializer.Serialize(new { error = e.ToString() })); }
}
class Fixture
{
    public string op;
    public uint seed;
    public bool tutorial;
    public State state;
    public GameAction action;
    public string raw;
    public string mode;
    public List<GameAction> actions;
    public bool roundtripEach;
}
