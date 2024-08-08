# Recast

## Lightweight online object processing service based on Cloudflare workers.

**_This open source code is under activate development, please use it with caution in production service._**

## Problems

1. When the original image size larger than 1m, the Photon library will throw an error on the following code:
   let photonObj = PhotonImage.new_from_byteslice(image);

    `Error: Promise will never complete.`

## Open source libraries used

This project uses the following open source libraries, all of which are based on the MIT license agreement:

-   [@cf-wasm/photon](https://github.com/fineshopdesign/cf-wasm/tree/main/packages/photon/) - For image processing
-   [backblaze-b2-samples/cloudflare-b2](https://github.com/backblaze-b2-samples/cloudflare-b2/) - For fetch compatible s3 object
-   [aws4fetch](https://github.com/mhart/aws4fetch) - For fetch s3 object
