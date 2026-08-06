package expo.modules.assetlocations

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException

class AssetLocationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AssetLocations")

    AsyncFunction("getAssetLocationsAsync") { ids: List<String> ->
      ids.map { id -> readLocation(id) }
    }

    // Android keeps JS longer than iOS when backgrounded; no-op retain API
    // keeps the JS call sites cross-platform.
    Function("beginBackgroundWork") { _: String ->
      true
    }

    Function("endBackgroundWork") {
      // no-op
    }
  }

  private fun readLocation(id: String): Map<String, Any?> {
    val base = mutableMapOf<String, Any?>("id" to id)
    val latLng = locationForId(id) ?: return base
    base["latitude"] = latLng.first
    base["longitude"] = latLng.second
    return base
  }

  private fun locationForId(id: String): Pair<Double, Double>? {
    val assetId = id.toLongOrNull() ?: return null
    val photoUri = ContentUris.withAppendedId(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      assetId,
    )
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        locationFromOriginalUri(photoUri)
      } else {
        locationFromDataColumn(assetId)
      }
    } catch (_: SecurityException) {
      null
    } catch (_: IOException) {
      null
    } catch (_: UnsupportedOperationException) {
      null
    }
  }

  private fun locationFromOriginalUri(photoUri: Uri): Pair<Double, Double>? {
    val uri =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        MediaStore.setRequireOriginal(photoUri)
      } else {
        photoUri
      }
    return context.contentResolver.openInputStream(uri)?.use { stream ->
      ExifInterface(stream).latLong?.let { (lat, lng) -> lat to lng }
    }
  }

  private fun locationFromDataColumn(assetId: Long): Pair<Double, Double>? {
    val projection = arrayOf(MediaStore.Images.Media.DATA)
    val selection = "${MediaStore.Images.Media._ID}=?"
    val args = arrayOf(assetId.toString())
    context.contentResolver.query(
      MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      projection,
      selection,
      args,
      null,
    )?.use { cursor ->
      if (!cursor.moveToFirst()) {
        return null
      }
      val path = cursor.getString(0) ?: return null
      return ExifInterface(path).latLong?.let { (lat, lng) -> lat to lng }
    }
    return null
  }
}
