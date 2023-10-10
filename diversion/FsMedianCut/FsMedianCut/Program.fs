open System
open SixLabors.ImageSharp
open SixLabors.ImageSharp.Processing
open SixLabors.ImageSharp.Processing.Processors.Quantization

[<EntryPoint>]
let main argv =
  try
    Environment.CurrentDirectory <- AppDomain.CurrentDomain.BaseDirectory

    use img = Image.Load "princess_orig.png"

    let quantizerOptions = QuantizerOptions (MaxColors = 14)
    let quantizer = WuQuantizer quantizerOptions

    let quantize (x : IImageProcessingContext) = 
      for y = 0 to (img.Height - 1) do
        x.Quantize (quantizer, Rectangle (0,y,img.Width, 1)) |> ignore
//      x.Quantize (quantizer) |> ignore
      ()
    img.Mutate quantize

    img.Save ("colors14.png")

    0
  with
  | e ->
    printfn "Exception: %s" e.Message
    99
