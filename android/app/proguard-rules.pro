# ProGuard rules for Alo AI
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep all API request & response data classes intact
-keep class xyz.zihan.aloai.api.** { *; }
-keepclassmembers class xyz.zihan.aloai.api.** { *; }

# Keep Gson annotations and classes
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.** { *; }

# Keep Retrofit & OkHttp
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep class okhttp3.** { *; }
