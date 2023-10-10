open System
open System.IO
open System.Text
open System.Collections.Generic
open SixLabors.ImageSharp
open SixLabors.ImageSharp.PixelFormats

[<EntryPoint>]
let main argv =
  try
    Environment.CurrentDirectory <- AppDomain.CurrentDomain.BaseDirectory

    use img = Image.Load<Rgba32> "princess_14.png"

    if img.Width <> 240 then
      failwith "Expected input image to 240 pixels wide"

    if img.Height <> 138 then
      failwith "Expected input image to 138 pixels high"

    let sb = new StringBuilder ()
    sb.AppendLine "image = {" |> ignore

    img.ProcessPixelRows (fun pa -> 
      for y = 0 to pa.Height - 1 do
        let colors = HashSet<Rgba32> ()
        let row = pa.GetRowSpan y
        for x = 0 to pa.Width - 1 do
          colors.Add row.[x] |> ignore

        if colors.Count > 14 then
          printfn "At line %d we found more than 14 colors. We found %d colors" y colors.Count

        let colorNumbers = Dictionary<Rgba32, int> ()
        colors 
        |> Seq.iteri (fun i c -> colorNumbers.Add (c, i+2))

        sb.Append "  {" |> ignore

        for c in colors do
          sb.Append c.R |> ignore
          sb.Append "," |> ignore
          sb.Append c.G |> ignore
          sb.Append "," |> ignore
          sb.Append c.B |> ignore
          sb.Append "," |> ignore
        for i = colors.Count to 13 do
          sb.Append "0,0,0," |> ignore
          ()

        for x = 0 to (pa.Width - 1)/4 do
          let o = x*4
          let c0 = colorNumbers.[row.[o+0]]
          let c1 = colorNumbers.[row.[o+0]]
          let c2 = colorNumbers.[row.[o+0]]
          let c3 = colorNumbers.[row.[o+0]]

          let c = c0 <<< 24 ||| c1 <<< 16 ||| c2 <<< 8 ||| c3

          sb.AppendFormat ("0x{0:X},", c) |> ignore

        sb.AppendLine "}," |> ignore
      )

    sb.AppendLine "}" |> ignore

    File.WriteAllText ("image.lua", sb.ToString ())

    0
  with
  | e ->
    printfn "Exception: %s" e.Message
    99
