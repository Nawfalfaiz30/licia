plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val liciaUrl = providers.gradleProperty("LICIA_URL").orElse("https://licia.site").get().trimEnd('/')
val liciaHost = java.net.URI(liciaUrl).host ?: "licia.site"
val liciaVersionFile = rootProject.file("../../config/licia-version.json")
val liciaVersion = if (liciaVersionFile.exists()) {
    val versionText = liciaVersionFile.readText()
    Regex("""\"appVersion\"\s*:\s*\"([^\"]+)\"""").find(versionText)?.groupValues?.getOrNull(1) ?: "0.57.0"
} else "0.57.0"

android {
    namespace = "com.licia.lifeos"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.licia.lifeos"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = liciaVersion
        buildConfigField("String", "LICIA_URL", "\"$liciaUrl\"")
        buildConfigField("String", "LICIA_HOST", "\"$liciaHost\"")
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        debug {
            manifestPlaceholders["allowCleartext"] = "true"
            manifestPlaceholders["liciaHost"] = liciaHost
        }
        release {
            manifestPlaceholders["allowCleartext"] = "false"
            manifestPlaceholders["liciaHost"] = liciaHost
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
