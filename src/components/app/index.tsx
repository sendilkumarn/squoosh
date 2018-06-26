import { h, Component } from 'preact';
import { bind, bitmapToImageData } from '../../lib/util';
import * as style from './style.scss';
import Output from '../output';
import Options from '../options';

import { Encoder } from '../../codecs/codec';
import IdentityEncoder, { EncodeOptions as IdentityEncodeOptions } from '../../codecs/identity/encoder';
import MozJpegEncoder, { EncodeOptions as MozJpegEncodeOptions } from '../../codecs/mozjpeg/encoder.worker';

export type ImageType = 'original' | 'MozJpeg';

export type CodecOptions = IdentityEncodeOptions | MozJpegEncodeOptions;

interface EncoderDescription {
  name: string;
  encoder: new () => Encoder<CodecOptions>;
}

interface EncoderDescriptionMap {
  [key: string]: EncoderDescription;
}

const ENCODERS: EncoderDescriptionMap = {
  original: {
    name: 'Original Image',
    encoder: IdentityEncoder
  },
  MozJpeg: {
    name: 'JPEG',
    encoder: MozJpegEncoder
  }
};

/** Represents an encoded version of sourceFile */
interface Image {
  /** The encoding type for this image view */
  type: ImageType;
  /** Configured option values for the encoder */
  options: CodecOptions;
  /** Resulting encoded image data */
  data?: ImageBitmap;
  /** Each encode of an image increments this counter, invalidating any pending previous encodes. */
  counter: number;
  /** Indicates encoding or other processing is  */
  loading: boolean;
}

interface Props {}

interface State {
  /** The dropped/selected file we're encoding */
  sourceFile?: File;
  /** Extracted bitmap from sourceFile */
  sourceImg?: ImageBitmap;
  /** Extracted raw image data from sourceFile */
  sourceData?: ImageData;
  /** Encoded image versions to display */
  images: Array<Image>;
  /** Indicates sourceFile is being loaded/decoded */
  loading: boolean;
  /** Any global error, such as an image decoding error */
  error?: string;
}

export default class App extends Component<Props, State> {
  state: State = {
    loading: false,
    images: [
      { type: 'original', options: {}, loading: false, counter: 0 },
      { type: 'MozJpeg', options: { quality: 7 }, loading: false, counter: 0 }
    ]
  };

  constructor() {
    super();
    // In development, persist application state across hot reloads:
    if (process.env.NODE_ENV === 'development') {
      this.setState(window.STATE);
      let oldCDU = this.componentDidUpdate;
      this.componentDidUpdate = (props, state) => {
        if (oldCDU) oldCDU.call(this, props, state);
        window.STATE = this.state;
      };
    }
  }

  setImageTypeAndOptions(index: number, type?: ImageType, options: any = {}) {
    const images = this.state.images.slice();
    const image = images[index];
    images[index] = {
      ...image,
      type: type || image.type,
      options,
      loading: false,
      counter: image.counter + 1
    };
    this.setState({ images });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { sourceImg, sourceData, images } = this.state;
    for (let i = 0; i < images.length; i++) {
      if (sourceData !== prevState.sourceData || images[i] !== prevState.images[i]) {
        this.updateImage(i);
      }
    }
    if (sourceImg !== prevState.sourceImg && prevState.sourceImg) {
      prevState.sourceImg.close();
    }
  }

  @bind
  async onFileChange(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const sourceFile = fileInput.files && fileInput.files[0];
    if (!sourceFile) return;
    this.setState({ loading: true });
    try {
      const sourceImg = await createImageBitmap(sourceFile);
      // compute the corresponding ImageData once since it only changes when the file changes:
      const sourceData = await bitmapToImageData(sourceImg);
      this.setState({ sourceFile, sourceImg, sourceData, error: undefined, loading: false });
    } catch (err) {
      this.setState({ error: 'IMAGE_INVALID', loading: false });
    }
  }

  async updateImage(index: number) {
    const { sourceData, images } = this.state;
    if (!sourceData) return;
    let image = images[index];
    // Each time we trigger an async encode, the ID changes.
    const id = ++image.counter;
    image.loading = true;
    this.setState({ });
    let result = await this.updateCompressedImage(sourceData, image.type, image.options);
    image = this.state.images[index];
    // If another encode has been intiated since we started, ignore this one.
    if (image.counter !== id) return;
    image.data = result;
    image.loading = false;
    this.setState({ });
  }

  async updateCompressedImage(sourceData: ImageData, type: ImageType, options: CodecOptions) {
    try {
      const encoder = await new ENCODERS[type].encoder() as Encoder<CodecOptions>;
      const compressedData = await encoder.encode(sourceData, options);
      let imageData;
      if (compressedData instanceof ArrayBuffer) {
        imageData = new Blob([compressedData], {
          type: ENCODERS[type].encoder.mimeType || ''
        });
      } else {
        imageData = compressedData;
      }
      return await createImageBitmap(imageData);
    } catch (err) {
      console.error(`Encoding error (type=${type}): ${err}`);
    }
  }

  render({ }: Props, { loading, error, images }: State) {
    for (let image of images) {
      if (image.loading) loading = true;
    }
    const leftImg = images[0].data;
    const rightImg = images[1].data;

    return (
      <div id="app" class={style.app}>
        {(leftImg && rightImg) ? (
          <Output leftImg={leftImg} rightImg={rightImg} />
        ) : (
          <div class={style.welcome}>
            <h1>Select an image</h1>
            <input type="file" onChange={this.onFileChange} />
          </div>
        )}
        {images.map((image, index: number) => (
          <span class={index ? style.rightLabel : style.leftLabel}>{ENCODERS[image.type].name}</span>
        ))}
        {images.map((image, index: number) => (
          <Options
            class={index ? style.rightOptions : style.leftOptions}
            name={index ? 'Right' : 'Left'}
            type={image.type}
            options={image.options}
            onTypeChange={this.setImageTypeAndOptions.bind(this, index)}
            onOptionsChange={this.setImageTypeAndOptions.bind(this, index, null)}
          />
        ))}
        {loading && <span style={{ position: 'fixed', top: 0, left: 0 }}>Loading...</span>}
        {error && <span style={{ position: 'fixed', top: 0, left: 0 }}>Error: {error}</span>}
      </div>
    );
  }
}
