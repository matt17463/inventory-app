import Foundation
import ImageIO
import Vision

struct TextBox: Codable {
    let text: String
    let x: Double
    let y: Double
    let width: Double
    let confidence: Float
    var center: Double { x + width / 2 }
    var label: String {
        let value = text.lowercased().split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        if value == "uv1" { return "uv 1" }
        if value == "uv2" { return "uv 2" }
        return value
    }
}

struct Head: Codable {
    let temperature_c: Double
    let mode: String
}

struct Result: Codable {
    let state: String
    let reason: String?
    let uv_head_1: Head?
    let uv_head_2: Head?
}

func readHeads(_ boxes: [TextBox]) -> (Head, Head)? {
    let words = boxes.filter { $0.confidence >= 0.65 }
    func one(_ label: String) -> TextBox? {
        let matches = words.filter { $0.label == label }
        return matches.count == 1 ? matches[0] : nil
    }
    guard let title = one("device health"), let left = one("uv 1"), let right = one("uv 2"),
          let environment = one("environment"), left.center + 0.15 < right.center,
          title.y > max(left.y, right.y), abs(left.y - right.y) < 0.06,
          environment.y < min(left.y, right.y),
          !words.contains(where: { $0.label == "not connected" }) else { return nil }

    let modes = ["working mode": "normal", "sleep mode": "sleep",
                 "sleeping mode": "sleep", "vacation mode": "vacation"]
    let temperaturePattern = /^(-?[0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*[°º]\s*c$/
    let boundary = right.x - 0.008
    func head(isLeft: Bool) -> Head? {
        let column = words.filter {
            ($0.center < boundary) == isLeft && $0.y < max(left.y, right.y) && $0.y > environment.y
        }
        let temperatures = column.compactMap { word -> Double? in
            guard let match = word.label.wholeMatch(of: temperaturePattern),
                  let value = Double(match.1.replacingOccurrences(of: ",", with: ".")),
                  (-20...120).contains(value) else { return nil }
            return value
        }
        let observedModes = Set(column.compactMap { modes[$0.label] })
        guard Set(temperatures).count == 1, let temperature = temperatures.first,
              observedModes.count == 1, let mode = observedModes.first else { return nil }
        return Head(temperature_c: temperature, mode: mode)
    }
    guard let first = head(isLeft: true), let second = head(isLeft: false) else { return nil }
    return (first, second)
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count == 1 || (arguments.count == 2 && arguments[0] == "--fixture") else {
    FileHandle.standardError.write(Data("Usage: OmniHealthOCR screenshot.png | --fixture boxes.json\n".utf8))
    exit(2)
}
let input = URL(fileURLWithPath: arguments.last!)
let boxes: [TextBox]
if arguments.count == 2 {
    boxes = try JSONDecoder().decode([TextBox].self, from: Data(contentsOf: input))
} else {
    guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          image.width <= 7000, image.height <= 7000 else {
        FileHandle.standardError.write(Data("Choose a readable Device Health screenshot under 7000 × 7000 pixels.\n".utf8))
        exit(2)
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(cgImage: image).perform([request])
    } catch {
        FileHandle.standardError.write(Data("macOS Vision could not run text recognition on this image.\n".utf8))
        exit(2)
    }
    boxes = (request.results ?? []).compactMap { observation in
        guard let text = observation.topCandidates(1).first else { return nil }
        let rect = observation.boundingBox
        return TextBox(text: text.string, x: rect.minX, y: rect.midY,
                       width: rect.width, confidence: text.confidence)
    }
}
let result: Result
if let (first, second) = readHeads(boxes) {
    result = Result(state: "screenshot_observation", reason: nil,
                    uv_head_1: first, uv_head_2: second)
} else {
    result = Result(state: "unavailable",
                    reason: "Capture Device Health with the title, both UV heads, and the Environment heading in one crop.",
                    uv_head_1: nil, uv_head_2: nil)
}
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
print(String(decoding: try encoder.encode(result), as: UTF8.self))
