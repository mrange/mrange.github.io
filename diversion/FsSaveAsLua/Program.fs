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

    use img = Image.Load<Rgba32> "princess_15.png"

    if img.Width <> 240 then
      failwith "Expected input image to 240 pixels wide"

    if img.Height <> 138 then
      failwith "Expected input image to 138 pixels high"

    let cols    = new StringBuilder ()
    let pixels  = Array2D.zeroCreate 256 256

    cols.AppendLine "rasterBars = {" |> ignore

    img.ProcessPixelRows (fun pa -> 
      for y = 0 to pa.Height - 1 do
        let colors = HashSet<Rgba32> ()
        let row = pa.GetRowSpan y
        for x = 0 to pa.Width - 1 do
          colors.Add row.[x] |> ignore

        if colors.Count > 15 then
          printfn "At line %d we found more than 15 colors. We found %d colors" y colors.Count

        let colorNumbers = Dictionary<Rgba32, int> ()
        colors 
        |> Seq.iteri (fun i c -> colorNumbers.Add (c, i+1))

        cols.Append "  {" |> ignore

        for c in colors do
          cols.Append c.R |> ignore
          cols.Append "," |> ignore
          cols.Append c.G |> ignore
          cols.Append "," |> ignore
          cols.Append c.B |> ignore
          cols.Append "," |> ignore
        for i = colors.Count to 14 do
          cols.Append "0,0,0," |> ignore
          ()

        cols.AppendLine "}," |> ignore
        for x = 0 to pa.Width - 1 do
          pixels[x,y] <- colorNumbers.[row.[x]]
      )

    cols.AppendLine "}" |> ignore

    let boxes = ResizeArray ()
    for y = 0 to 3 do
      for x = 0 to 3 do
        let l = x*64
        let r = l+63
        let t = y*64
        let b = t+63
        let box = pixels[l..r,t..b]
        boxes.Add box

    let pixelsAsText = StringBuilder ()
    for box in boxes do
      for y = 0 to 63 do
        for x = 0 to 63 do
          pixelsAsText.AppendFormat ("{0:X}", (box.[x,y])) |> ignore
      for i = 0 to 127 do
        pixelsAsText.Append "0" |> ignore
      pixelsAsText.AppendLine () |> ignore

    File.WriteAllText ("rasterbars.lua", cols.ToString ())
    File.WriteAllText ("pixels.txt", pixelsAsText.ToString ())

    0
  with
  | e ->
    printfn "Exception: %s" e.Message
    99
