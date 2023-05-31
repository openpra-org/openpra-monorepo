import styles from './frontend-assets.module.css';

/* eslint-disable-next-line */
export interface FrontendAssetsProps {}

export function FrontendAssets(props: FrontendAssetsProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to FrontendAssets!</h1>
    </div>
  );
}

export default FrontendAssets;
