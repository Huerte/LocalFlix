# Keep Retrofit and Gson model classes
-keep class com.sarge.localflix.data.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
