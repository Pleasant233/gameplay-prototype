using System;
using System.IO;
using UnityEngine;

namespace ElementHabitat.Editor
{
    // An isolated verification checkout can publish evidence without sharing user storage.
    internal static class HabitatValidationPaths
    {
        public static string Artifacts
        {
            get
            {
                var configured = Environment.GetEnvironmentVariable("HABITAT_ARTIFACT_ROOT");
                return Path.GetFullPath(string.IsNullOrWhiteSpace(configured)
                    ? Path.Combine(Application.dataPath, "../../artifacts") : configured);
            }
        }
    }
}
