using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace Asfan.Anatomy
{
    /// <summary>Decrypts the data files written by tools/export_unity.mjs (AES-256-CBC, "HA3E" + IV + data).</summary>
    public static class AssetCrypto
    {
        static byte[] key;
        static byte[] Key
        {
            get
            {
                if (key == null) using (var sha = SHA256.Create()) key = sha.ComputeHash(Encoding.UTF8.GetBytes("ASFAN|HumanAnatomy3D|unity-assets|v1"));
                return key;
            }
        }

        public static byte[] Decrypt(byte[] data)
        {
            if (data.Length < 36 || data[0] != 'H' || data[1] != 'A' || data[2] != '3' || data[3] != 'E') return data;   // not encrypted
            var iv = new byte[16];
            Buffer.BlockCopy(data, 4, iv, 0, 16);
            using (var aes = Aes.Create())
            {
                aes.Key = Key; aes.IV = iv; aes.Mode = CipherMode.CBC; aes.Padding = PaddingMode.PKCS7;
                using (var dec = aes.CreateDecryptor()) return dec.TransformFinalBlock(data, 20, data.Length - 20);
            }
        }

        public static byte[] ReadBytes(string path) => Decrypt(File.ReadAllBytes(path));
        public static string ReadText(string path) => Encoding.UTF8.GetString(ReadBytes(path));
    }
}
