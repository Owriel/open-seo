export type WpConfig = {
  wpUrl: string;
  wpUser: string;
  hasPassword: boolean;
};

export type WpPublishResult = {
  postId: number;
  postUrl: string;
  editUrl: string;
  status: string;
};
