import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

extra["sideloadPropertyPrefix"] = "hsk4listening"
apply(from = rootProject.file("../android/sideload-signing.gradle.kts"))

val autoVersionCode: Int = extra["autoVersionCode"] as Int
val useCustomSigning: Boolean = extra["useCustomSigning"] as Boolean
val sideloadStoreFile: File? = if (useCustomSigning) extra["sideloadStoreFile"] as File else null
val sideloadStorePassword: String? = if (useCustomSigning) extra["sideloadStorePassword"] as String else null
val sideloadKeyAlias: String? = if (useCustomSigning) extra["sideloadKeyAlias"] as String else null
val sideloadKeyPassword: String? = if (useCustomSigning) extra["sideloadKeyPassword"] as String else null

android {
    namespace = "com.tepmex.hsk4listening"
    compileSdk = 36

    signingConfigs {
        if (useCustomSigning) {
            create("sideload") {
                storeFile = sideloadStoreFile
                storePassword = sideloadStorePassword
                keyAlias = sideloadKeyAlias
                keyPassword = sideloadKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "com.tepmex.hsk4listening"
        minSdk = 26
        targetSdk = 35
        versionCode = autoVersionCode
        versionName = "1.0.$autoVersionCode"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            signingConfig = if (useCustomSigning) {
                signingConfigs.getByName("sideload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (useCustomSigning) {
                signingConfigs.getByName("sideload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }
    androidResources {
        noCompress += "mp3"
    }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.icons)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.common)
    implementation(libs.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.espresso)
    androidTestImplementation(libs.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.ui.test.manifest)
}
