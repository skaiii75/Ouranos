# Ouranos 🌩️

**A Modern Web UI for Cloudflare R2 File Compression & Uploads**

Ouranos is a sleek, powerful, and user-friendly web application designed to streamline your media workflow with Cloudflare R2. It provides an elegant interface for client-side image and video compression, coupled with direct uploads to your R2 buckets via a companion Cloudflare Worker.

<p align="center">
  <img src="https://pub-47a9495fddc34f71be81eaf74ad8daf7.r2.dev/ouranos-image2.webp" width="200" alt="Ouranos LOGO">
</p>

---

## ✨ Features

-   **Client-Side Compression:** Compresses images (JPEG, PNG, WebP) and videos (MP4, WebM) in the browser before upload, saving bandwidth and storage.
-   **Direct R2 Integration:** Securely connects to your Cloudflare R2 buckets through a dedicated worker, keeping your assets within your ecosystem.
-   **Interactive Image Comparator:** Visually inspect compression quality in real-time before saving.
-   **Efficient Batch Processing:** Drag and drop multiple files or entire folders for bulk compression and uploading.
-   **Full R2 Navigation:** Browse your R2 buckets and nested folder structures, and create new folders on the fly.
-   **Setup Helper:** An integrated bucket manager helps list buckets from your Cloudflare account and generates the necessary `wrangler.jsonc` configuration.
-   **Modern UI/UX:** Includes a dark/light theme, a real-time log viewer for debugging, and a fully responsive design.

---

## 🚀 How It Works

The application consists of two main parts:

1.  **Frontend:** A static web application (built with Preact) that runs entirely in the user's browser. It handles the user interface, file selection, and client-side media compression.
2.  **Backend (Cloudflare Worker):** A lightweight worker (`ouranos-worker/src/index.js`) that acts as a secure proxy between the frontend and your Cloudflare R2 buckets. It handles CORS, lists available buckets, lists folder structures, and streams file uploads directly to R2.

This architecture ensures that your Cloudflare credentials are never exposed to the client.

---

## 🔧 Setup Guide

Follow these steps to deploy your own instance of Ouranos.

### Prerequisites

-   A [Cloudflare account](https://dash.cloudflare.com/sign-up).
-   [Node.js](https://nodejs.org/en/) installed on your machine.
-   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed (`npm install -g wrangler`).

### Part 1: Deploy the Cloudflare Worker

The worker is the bridge to your R2 buckets.

1.  **Navigate to the Worker Directory:**
    Open your terminal in the `ouranos-worker` directory.

2.  **Authenticate with Wrangler:**
    Run `wrangler login` and follow the instructions to log in to your Cloudflare account.

3.  **Create `wrangler.jsonc`:**
    The provided `ouranos-worker` directory does not include a configuration file. Create a file named `wrangler.jsonc` in this directory.

    **Important:** You need to link at least one R2 bucket for the worker to function. Use the following template and fill in your details.

    ```jsonc
    // ouranos-worker/wrangler.jsonc
    {
      "name": "ouranos-worker", // Choose a unique name for your worker
      "main": "src/index.js",
      "compatibility_date": "2024-05-15",
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID", // Find this in your Cloudflare dashboard
      "r2_buckets": [
        {
          "binding": "MY_BUCKET_BINDING", // A unique variable name for the bucket in uppercase snake_case (e.g., ASSETS_BUCKET)
          "bucket_name": "your-actual-r2-bucket-name" // The name of the R2 bucket you created in Cloudflare
        }
        // Add more buckets here if needed
        // {
        //   "binding": "MEDIA_PROD",
        //   "bucket_name": "production-media-assets"
        // }
      ]
    }
    ```
    > **Tip:** You can use the **Bucket Manager** in the app's settings later to easily generate this `r2_buckets` configuration.

4.  **Deploy the Worker:**
    Run the following command in the `ouranos-worker` directory:
    ```bash
    npx wrangler deploy
    ```
    After a successful deployment, Wrangler will output the URL of your worker (e.g., `https://ouranos-worker.your-name.workers.dev`). **Copy this URL.**

### Part 2: Deploy the Frontend

The frontend is a static site. You can host it anywhere, but Cloudflare Pages is an excellent, free option.

1.  **No Build Step:** The application is configured to run directly from source using import maps, so there's no build step required.
2.  **Deploy to Cloudflare Pages:**
    -   Push the entire project repository (including the frontend files at the root and the `ouranos-worker` directory) to GitHub.
    -   In your Cloudflare dashboard, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
    -   Select your repository.
    -   In the "Build settings", you can leave the build command and build output directory blank.
    -   Deploy the site.

---

## 💻 Usage

Once the frontend is live:

1.  **Connect to Your Worker:**
    -   On the first launch, the app will ask for your worker's URL.
    -   Paste the URL you copied after deploying the worker and click "Connect".

2.  **Select a Bucket:**
    -   The app will display all R2 buckets you linked in your `wrangler.jsonc` file.
    -   Click on a bucket to proceed.
    > **No buckets showing?** Use the settings icon (⚙️) to open the **Bucket Manager**. Provide your Cloudflare Account ID and an API Token (`Account.R2:Read` permissions) to list all buckets and generate the correct `wrangler.jsonc` configuration. You will need to re-deploy the worker after updating the config.

3.  **Choose a Destination:**
    -   You can either upload files to the root of the bucket or select an existing folder.
    -   You can also create a new folder at the root level.

4.  **Upload & Compress:**
    -   **Single File:** Drag and drop a single image or video. Use the options to adjust compression and quality. The image comparator shows a live preview. When ready, you can download the result or upload it directly to R2.
    -   **Batch Mode:** Drag and drop multiple files or a whole folder. Set the compression options for images and videos, then start the process. The app will compress and upload each file, showing its status in real-time.

---

## ⚠️ Troubleshooting

-   **CORS Errors:** The provided worker code (`ouranos-worker/src/index.js`) has permissive CORS headers (`'Access-Control-Allow-Origin': '*'`). For production, it is **highly recommended** to replace `*` with the domain of your deployed frontend application to enhance security.
-   **Critical Worker Error:** If the app displays a "Critical Worker Error" message, it means the worker's configuration on Cloudflare has become corrupt (this can happen if a linked bucket is deleted). The on-screen instructions guide you through a foolproof reset process: deploy with an empty `r2_buckets` array, then deploy again with the correct configuration.
-   **Authentication Error in Bucket Manager:** Ensure your API Token is active and has the `Account.R2:Read` permission.
