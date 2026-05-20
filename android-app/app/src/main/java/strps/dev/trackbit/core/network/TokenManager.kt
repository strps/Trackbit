package strps.dev.trackbit.core.network

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class TokenManager(context: Context) {

    // Generate a master key alias for encrypting/decrypting the preferences file
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    // EncryptedSharedPreferences dynamically encrypts keys and values on disk
    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "trackbit_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_TOKEN = "auth_bearer_token"
    }

    // Call this when the login API returns a successful token
    fun saveToken(token: String) {
        sharedPreferences.edit().putString(KEY_TOKEN, token).apply()
    }

    // Call this when initializing the app or making network requests
    fun getToken(): String? {
        return sharedPreferences.getString(KEY_TOKEN, null)
    }

    // Call this when the user logs out
    fun clearToken() {
        sharedPreferences.edit().remove(KEY_TOKEN).apply()
    }
}