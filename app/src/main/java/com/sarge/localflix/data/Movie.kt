package com.sarge.localflix.data

import com.google.gson.annotations.SerializedName

data class Movie(
    @SerializedName("name")     val name: String,
    @SerializedName("path")     val path: String,
    @SerializedName("ext")      val ext: String,
    @SerializedName("size")     val size: Long,
    @SerializedName("size_str") val sizeStr: String,
    @SerializedName("folder")   val folder: String
)
