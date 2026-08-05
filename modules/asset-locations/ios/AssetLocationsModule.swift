import ExpoModulesCore
import Photos

public class AssetLocationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AssetLocations")

    // Batch PHAsset.location — never opens image bytes / EXIF files.
    AsyncFunction("getAssetLocationsAsync") { (ids: [String]) -> [[String: Any]] in
      guard !ids.isEmpty else {
        return []
      }

      let fetch = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
      var byId: [String: [String: Any]] = [:]
      byId.reserveCapacity(fetch.count)

      fetch.enumerateObjects { asset, _, _ in
        var row: [String: Any] = ["id": asset.localIdentifier]
        if let location = asset.location {
          row["latitude"] = location.coordinate.latitude
          row["longitude"] = location.coordinate.longitude
        }
        byId[asset.localIdentifier] = row
      }

      // Preserve input order; missing ids still get a row (no GPS).
      return ids.map { id in
        byId[id] ?? ["id": id]
      }
    }
  }
}
